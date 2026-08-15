import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { COURSE_ROSTER_ENABLED } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const TERM_ORDER: Record<string, number> = { WI: 0, SP: 1, SU: 2, FA: 3 };

// GET /api/roster/lookup?code=cs2110 — autofill a course from the roster mirror.
// Returns the most recent term's data for that course code.
export async function GET(req: NextRequest) {
  if (!COURSE_ROSTER_ENABLED) {
    return NextResponse.json(
      { detail: "Course roster is temporarily unavailable." },
      { status: 503 },
    );
  }

  const auth = await getRequiredSession();
  if ("error" in auth) return auth.error;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ detail: "Not configured." }, { status: 503 });
  }

  // Normalize: lowercase, strip whitespace + PostgREST metachars (defense-in-depth).
  const raw = req.nextUrl.searchParams.get("code") ?? "";
  const needle = raw.toLowerCase().replace(/\s+/g, "").replace(/[%,()*:]/g, "");
  if (!needle) {
    return NextResponse.json({ found: false });
  }

  const { data: rows, error } = await supabase
    .from("cornell_courses")
    .select(
      "roster, subject, catalog_nbr, title_long, credits_min, credits_max, instructors",
    )
    .eq("code_norm", needle);
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 502 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ found: false });
  }

  // Rank by most recent term. Roster code string sort is NOT chronological, so
  // resolve year/term from the rosters table.
  const rosterCodes = [...new Set(rows.map((r) => r.roster))];
  const { data: rosterRows } = await supabase
    .from("cornell_rosters")
    .select("code, descr, year, term")
    .in("code", rosterCodes);
  const rosterMeta = new Map(
    (rosterRows ?? []).map((r) => [
      r.code,
      { descr: r.descr as string, year: r.year as number, term: r.term as string },
    ]),
  );
  const rank = (code: string) => {
    const m = rosterMeta.get(code);
    return m ? m.year * 10 + (TERM_ORDER[m.term] ?? 0) : -1;
  };

  const best = rows.reduce((a, b) => (rank(b.roster) > rank(a.roster) ? b : a));
  const meta = rosterMeta.get(best.roster);

  return NextResponse.json({
    found: true,
    subject: best.subject,
    catalogNbr: best.catalog_nbr,
    title: best.title_long,
    creditsMin: best.credits_min,
    creditsMax: best.credits_max,
    instructors: best.instructors ?? [],
    roster: best.roster,
    rosterDescr: meta?.descr ?? best.roster,
  });
}
