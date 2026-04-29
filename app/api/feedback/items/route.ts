import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSession,
  getBackendApiBaseUrl,
  getBackendInternalApiSecret,
  getRequiredSession,
} from "@/lib/server-auth";

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
};

export async function POST(req: NextRequest) {
  const auth = await getRequiredSession();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const res = await fetch(`${getBackendApiBaseUrl()}/feedback/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": auth.userId,
      "X-User-Email": auth.userEmail,
      "X-Internal-Api-Secret": getBackendInternalApiSecret(),
    },
    body: JSON.stringify(body),
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;

  const res = await fetch(`${getBackendApiBaseUrl()}/feedback/`, {
    headers: {
      "X-User-Id": auth.userId,
      "X-User-Email": auth.userEmail,
      "X-Internal-Api-Secret": getBackendInternalApiSecret(),
    },
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}
