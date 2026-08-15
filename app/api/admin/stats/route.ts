import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSession,
  getBackendApiBaseUrl,
  getBackendInternalApiSecret,
} from "@/lib/server-auth";

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
};

export async function GET(req: NextRequest) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;

  const days = req.nextUrl.searchParams.get("days");
  const qs = days ? `?days=${encodeURIComponent(days)}` : "";
  const res = await fetch(`${getBackendApiBaseUrl()}/admin/stats/${qs}`, {
    headers: {
      "X-User-Id": auth.userId,
      "X-User-Email": auth.userEmail,
      "X-Internal-Api-Secret": getBackendInternalApiSecret(),
    },
    cache: "no-store",
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}
