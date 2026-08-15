import { NextRequest, NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { COURSE_ROSTER_ENABLED } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

// GET /api/roster?roster=FA26&roster=SP26&subject=CS&q=algo&page=0
// roster/subject repeatable; none = no filter on that field.
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

  const sp = req.nextUrl.searchParams;
  // Semester type: FA | SP | SU | WI (repeatable).
  const terms = sp
    .getAll("term")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const subjects = sp.getAll("subject").map((s) => s.trim()).filter(Boolean);
  // Course level buckets: 1000,2000,3000,4000,5000 (5000 = 5000+).
  const levels = sp
    .getAll("level")
    .map((l) => Number.parseInt(l, 10))
    .filter((n) => Number.isFinite(n));
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(0, Number.parseInt(sp.get("page") ?? "0", 10) || 0);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(sp.get("pageSize") ?? String(PAGE_SIZE), 10) || PAGE_SIZE,
    ),
  );

  // Merge the same course across terms into one row (grouped by code_norm).
  // q is passed as a bound parameter, so ilike wildcards in it only widen the
  // match — no injection risk.
  const { data, error } = await supabase.rpc("roster_courses_grouped", {
    p_terms: terms.length ? terms : null,
    p_subjects: subjects.length ? subjects : null,
    p_q: q || null,
    p_levels: levels.length ? levels : null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 502 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown> & { total_count: number }>;
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const courses = rows.map(({ total_count: _drop, ...rest }) => rest);

  return NextResponse.json({
    courses,
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total,
  });
}
