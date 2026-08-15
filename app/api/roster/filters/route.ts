import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { COURSE_ROSTER_ENABLED } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const TERM_ORDER: Record<string, number> = { FA: 0, SU: 1, SP: 2, WI: 3 };

// GET /api/roster/filters            -> { rosters, subjects: [] }
// GET /api/roster/filters?roster=FA26 -> { rosters, subjects for that term }
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

  const rosterFilter = req.nextUrl.searchParams
    .getAll("roster")
    .map((r) => r.trim())
    .filter(Boolean);

  const { data: rosterRows, error: rosterErr } = await supabase
    .from("cornell_rosters")
    .select("code, descr, year, term, is_active");
  if (rosterErr) {
    return NextResponse.json({ detail: rosterErr.message }, { status: 502 });
  }

  // Reverse-chronological: newest year first, FA > SU > SP > WI within a year.
  const rosters = (rosterRows ?? []).sort((a, b) =>
    a.year !== b.year
      ? b.year - a.year
      : (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9),
  );

  // Subjects: union across selected terms (or all terms if none selected),
  // deduped by code.
  let subjectsQuery = supabase
    .from("cornell_subjects")
    .select("code, descr")
    .order("code");
  if (rosterFilter.length) subjectsQuery = subjectsQuery.in("roster", rosterFilter);

  const { data: subjectRows, error: subjErr } = await subjectsQuery;
  if (subjErr) {
    return NextResponse.json({ detail: subjErr.message }, { status: 502 });
  }

  const byCode = new Map<string, { code: string; descr: string | null }>();
  for (const s of subjectRows ?? []) {
    if (!byCode.has(s.code)) byCode.set(s.code, s);
  }
  const subjects = [...byCode.values()];

  return NextResponse.json({ rosters, subjects });
}
