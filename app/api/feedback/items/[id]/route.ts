import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSession,
  getBackendApiBaseUrl,
  getBackendInternalApiSecret,
} from "@/lib/server-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await req.json();
  const res = await fetch(`${getBackendApiBaseUrl()}/feedback/${id}/`, {
    method: "PATCH",
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

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await getAdminSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const res = await fetch(`${getBackendApiBaseUrl()}/feedback/${id}/`, {
    method: "DELETE",
    headers: {
      "X-User-Id": auth.userId,
      "X-User-Email": auth.userEmail,
      "X-Internal-Api-Secret": getBackendInternalApiSecret(),
    },
  });

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}
