import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRosters } from "@/lib/cornell-roster";
import { syncRoster } from "@/lib/cornell-sync";

// Active roster only (~150 subjects ~= 2.5 min) fits the function timeout.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function getEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const cronSecret = getEnv("CRON_SECRET");
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  try {
    const rosters = await getRosters();
    const active = rosters.find((r) => r.isActive);
    if (!active) {
      return NextResponse.json(
        { error: "No active roster found" },
        { status: 502 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const result = await syncRoster(supabase, active, { stopOnError: true });

    if (result.errors.length > 0) {
      console.error("[cornell-refresh] sync incomplete:", result.errors);
      return NextResponse.json(
        {
          error: "Refresh incomplete",
          roster: result.roster,
          subjects: result.subjects,
          courses: result.courses,
          details: result.errors,
        },
        { status: 502 },
      );
    }

    const { error: refreshError } = await supabase.rpc(
      "refresh_roster_grouped",
    );
    if (refreshError) {
      throw new Error(`materialized view refresh: ${refreshError.message}`);
    }

    return NextResponse.json({
      ok: true,
      roster: result.roster,
      subjects: result.subjects,
      courses: result.courses,
      errors: 0,
    });
  } catch (err) {
    console.error("[cornell-refresh] error:", err);
    return NextResponse.json(
      { error: "Refresh failed", detail: String(err) },
      { status: 502 },
    );
  }
}
