import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const ADMIN_EMAILS = new Set([
  "aayanhussainw07@gmail.com",
  "ah2425@gmail.com",
]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
};

const getAdminSession = async () => {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return { error: NextResponse.json({ detail: "Unauthorized." }, { status: 401 }) };
  }
  if (!ADMIN_EMAILS.has(userEmail.toLowerCase())) {
    return { error: NextResponse.json({ detail: "Forbidden." }, { status: 403 }) };
  }
  return { session, userEmail };
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { session, userEmail, error } = await getAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/feedback/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.user.id ?? userEmail,
      "X-User-Email": userEmail,
    },
    body: JSON.stringify(body),
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { session, userEmail, error } = await getAdminSession();
  if (error) return error;

  const { id } = await context.params;
  const res = await fetch(`${API_BASE_URL}/feedback/${id}/`, {
    method: "DELETE",
    headers: {
      "X-User-Id": session.user.id ?? userEmail,
      "X-User-Email": userEmail,
    },
  });

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}
