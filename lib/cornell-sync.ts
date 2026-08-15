// Shared Cornell roster -> Supabase sync. Used by the backfill script and cron route.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSubjects,
  getClasses,
  type Roster,
  type CornellCourse,
} from "./cornell-roster";

const COURSE_UPSERT_CHUNK = 500;

export type SyncProgress = {
  roster: string;
  subject: string;
  subjectIndex: number;
  subjectCount: number;
  coursesUpserted: number;
};

export type SyncOptions = {
  onProgress?: (p: SyncProgress) => void;
  // Skip subjects up to and including this code (checkpoint resume).
  resumeAfterSubject?: string | null;
  // Restrict to a single subject code (scoped testing).
  onlySubject?: string | null;
  // Stop at the first failed subject so a checkpoint cannot skip over a gap.
  stopOnError?: boolean;
  // Injectable source used by regression tests; production uses Cornell.
  source?: {
    getSubjects: typeof getSubjects;
    getClasses: typeof getClasses;
  };
};

export type SyncResult = {
  roster: string;
  subjects: number;
  courses: number;
  errors: string[];
};

function toCourseRow(roster: string, c: CornellCourse, fetchedAt: string) {
  return {
    roster,
    subject: c.subject,
    catalog_nbr: c.catalogNbr,
    code_norm: c.codeNorm,
    title_long: c.titleLong,
    title_short: c.titleShort,
    description: c.description,
    credits_min: c.creditsMin,
    credits_max: c.creditsMax,
    grading_basis: c.gradingBasis,
    prereqs: c.prereqs,
    distr_reqs: c.distrReqs,
    acad_career: c.acadCareer,
    instructors: c.instructors,
    fetched_at: fetchedAt,
  };
}

export async function upsertRoster(
  supabase: SupabaseClient,
  roster: Roster,
): Promise<void> {
  const { error } = await supabase.from("cornell_rosters").upsert(
    {
      code: roster.code,
      descr: roster.descr,
      year: roster.year,
      term: roster.term,
      is_active: roster.isActive,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "code" },
  );
  if (error) throw new Error(`upsert roster ${roster.code}: ${error.message}`);
}

// Pull all subjects + classes for one roster and upsert into Supabase.
export async function syncRoster(
  supabase: SupabaseClient,
  roster: Roster,
  opts: SyncOptions = {},
): Promise<SyncResult> {
  await upsertRoster(supabase, roster);

  const source = opts.source ?? { getSubjects, getClasses };
  const subjects = await source.getSubjects(roster.code);
  const result: SyncResult = {
    roster: roster.code,
    subjects: 0,
    courses: 0,
    errors: [],
  };

  const resumeIndex = opts.resumeAfterSubject
    ? subjects.findIndex((subject) => subject.code === opts.resumeAfterSubject)
    : -1;

  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects[i];

    // If a checkpoint's subject disappeared upstream, start the roster again.
    // Upserts are idempotent and this avoids silently skipping the whole roster.
    if (resumeIndex >= 0 && i <= resumeIndex) continue;

    if (opts.onlySubject && subject.code !== opts.onlySubject) continue;

    try {
      // Upsert the subject row.
      const { error: subErr } = await supabase.from("cornell_subjects").upsert(
        { roster: roster.code, code: subject.code, descr: subject.descr },
        { onConflict: "roster,code" },
      );
      if (subErr) throw new Error(`subject ${subject.code}: ${subErr.message}`);

      const courses = await source.getClasses(roster.code, subject.code);
      const fetchedAt = new Date().toISOString();
      const rows = courses.map((c) => toCourseRow(roster.code, c, fetchedAt));

      for (let j = 0; j < rows.length; j += COURSE_UPSERT_CHUNK) {
        const chunk = rows.slice(j, j + COURSE_UPSERT_CHUNK);
        const { error } = await supabase
          .from("cornell_courses")
          .upsert(chunk, { onConflict: "roster,subject,catalog_nbr" });
        if (error) throw new Error(`courses ${subject.code}: ${error.message}`);
      }

      // Reconcile removals only after every upstream row was fetched and
      // upserted. The shared timestamp is a generation marker for this subject.
      let staleCourses = supabase
        .from("cornell_courses")
        .delete()
        .eq("roster", roster.code)
        .eq("subject", subject.code);
      if (rows.length > 0) staleCourses = staleCourses.lt("fetched_at", fetchedAt);
      const { error: deleteError } = await staleCourses;
      if (deleteError) {
        throw new Error(`delete stale courses ${subject.code}: ${deleteError.message}`);
      }

      result.subjects += 1;
      result.courses += rows.length;
      opts.onProgress?.({
        roster: roster.code,
        subject: subject.code,
        subjectIndex: i,
        subjectCount: subjects.length,
        coursesUpserted: rows.length,
      });
    } catch (err) {
      result.errors.push(`${roster.code}/${subject.code}: ${String(err)}`);
      if (opts.stopOnError) break;
    }
  }

  // A full successful roster pass also removes subjects Cornell no longer
  // publishes. Cascading foreign keys remove their obsolete courses.
  if (!opts.onlySubject && result.errors.length === 0) {
    const currentCodes = new Set(subjects.map((subject) => subject.code));
    const { data: storedSubjects, error: selectError } = await supabase
      .from("cornell_subjects")
      .select("code")
      .eq("roster", roster.code);
    if (selectError) {
      result.errors.push(
        `${roster.code}: list stale subjects: ${selectError.message}`,
      );
    } else {
      const staleCodes = (storedSubjects ?? [])
        .map((subject) => subject.code)
        .filter((code) => !currentCodes.has(code));
      if (staleCodes.length > 0) {
        const { error: deleteError } = await supabase
          .from("cornell_subjects")
          .delete()
          .eq("roster", roster.code)
          .in("code", staleCodes);
        if (deleteError) {
          result.errors.push(
            `${roster.code}: delete stale subjects: ${deleteError.message}`,
          );
        }
      }
    }
  }

  return result;
}
