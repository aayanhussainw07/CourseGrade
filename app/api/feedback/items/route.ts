import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const ADMIN_EMAILS = new Set([
  "aayanhussainw07@gmail.com",
  "ah2425@gmail.com",
]);

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/feedback/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.user.id ?? session.user.email,
    },
    body: JSON.stringify(body),
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized." }, { status: 401 });
  }

  if (!ADMIN_EMAILS.has(session.user.email.toLowerCase())) {
    return NextResponse.json({ detail: "Forbidden." }, { status: 403 });
  }

  const res = await fetch(`${API_BASE_URL}/feedback/`, {
    headers: {
      "X-User-Id": session.user.id ?? session.user.email,
      "X-User-Email": session.user.email,
    },
  });

  const data = await readJson(res);
  return NextResponse.json(data, { status: res.status });
}
