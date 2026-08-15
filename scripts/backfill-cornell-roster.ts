// One-time historical backfill of the Cornell Class Roster into Supabase.
// Run: npm run backfill:cornell   (loads .env.local via node --env-file)
// Resumable: progress is checkpointed to scripts/.cornell-backfill-checkpoint.json.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getRosters, type Roster } from "../lib/cornell-roster";
import { syncRoster } from "../lib/cornell-sync";

const YEARS_BACK = 5;
const CHECKPOINT = join(
  dirname(fileURLToPath(import.meta.url)),
  ".cornell-backfill-checkpoint.json",
);

const TERM_ORDER: Record<string, number> = { WI: 0, SP: 1, SU: 2, FA: 3 };

type Checkpoint = { roster: string; subject: string };

function readCheckpoint(): Checkpoint | null {
  if (!existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, "utf8")) as Checkpoint;
  } catch {
    return null;
  }
}

function writeCheckpoint(cp: Checkpoint): void {
  writeFileSync(CHECKPOINT, JSON.stringify(cp));
}

function sortRosters(rosters: Roster[]): Roster[] {
  return [...rosters].sort((a, b) =>
    a.year !== b.year
      ? a.year - b.year
      : (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9),
  );
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).",
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const onlySubject = process.env.CORNELL_ONLY_SUBJECT?.trim() || null; // scoped test

  const all = await getRosters();
  const cutoff = new Date().getFullYear() - YEARS_BACK;
  let rosters = sortRosters(all.filter((r) => r.year >= cutoff));
  // Scoped test: a single subject also restricts to the active roster, so the
  // run stays fast (1 roster x 1 subject) instead of crawling every term.
  if (onlySubject) rosters = rosters.filter((r) => r.isActive);
  console.log(
    `[backfill] ${rosters.length} rosters in scope (year >= ${cutoff}): ${rosters
      .map((r) => r.code)
      .join(", ")}`,
  );

  const cp = onlySubject ? null : readCheckpoint(); // scoped test ignores checkpoint
  if (cp) console.log(`[backfill] resuming after checkpoint`, cp);

  let reached = !cp; // if no checkpoint, start immediately
  let totalCourses = 0;
  const allErrors: string[] = [];

  for (const roster of rosters) {
    // Skip rosters fully completed before the checkpoint roster.
    if (!reached) {
      if (roster.code === cp!.roster) reached = true;
      else continue;
    }
    const resumeAfterSubject =
      cp && roster.code === cp.roster ? cp.subject : null;

    console.log(`[backfill] === ${roster.code} (${roster.descr}) ===`);
    const result = await syncRoster(supabase, roster, {
      resumeAfterSubject,
      onlySubject,
      stopOnError: true,
      onProgress: (p) => {
        writeCheckpoint({ roster: p.roster, subject: p.subject });
        console.log(
          `[backfill]   ${p.roster} ${p.subject} (${p.subjectIndex + 1}/${p.subjectCount}) -> ${p.coursesUpserted} courses`,
        );
      },
    });
    totalCourses += result.courses;
    allErrors.push(...result.errors);
    console.log(
      `[backfill] ${roster.code} done: ${result.subjects} subjects, ${result.courses} courses, ${result.errors.length} errors`,
    );
    if (result.errors.length > 0) break;
  }

  console.log(
    `[backfill] COMPLETE: ${totalCourses} courses across ${rosters.length} rosters. ${allErrors.length} errors.`,
  );

  // Rebuild the grouped materialized view the roster page reads from.
  const { error: refreshError } = await supabase.rpc("refresh_roster_grouped");
  if (refreshError) {
    console.log(`[backfill] MV refresh failed: ${refreshError.message}`);
    allErrors.push(`materialized view refresh: ${refreshError.message}`);
  } else {
    console.log("[backfill] refreshed cornell_courses_grouped_mv");
  }
  if (allErrors.length) {
    console.log("[backfill] errors:\n" + allErrors.join("\n"));
    process.exitCode = 1;
  } else if (existsSync(CHECKPOINT)) {
    rmSync(CHECKPOINT); // clean finish -> drop checkpoint
  }
}

main().catch((err) => {
  console.error("[backfill] FATAL:", err);
  process.exitCode = 1;
});
