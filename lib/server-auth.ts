import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const FALLBACK_ADMIN_EMAILS = ["aayanhussainw07@gmail.com", "ah2425@gmail.com"];
const DEV_INTERNAL_API_SECRET = "coursegrade-dev-internal-secret";

export function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured?.length ? configured : FALLBACK_ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email && getAdminEmails().has(email.toLowerCase()));
}

export async function getRequiredSession() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  if (!userId || !userEmail) {
    return {
      error: NextResponse.json({ detail: "Unauthorized." }, { status: 401 }),
    };
  }

  return { session, userId, userEmail };
}

export async function getAdminSession() {
  const auth = await getRequiredSession();
  if ("error" in auth) return auth;

  if (!isAdminEmail(auth.userEmail)) {
    return {
      error: NextResponse.json({ detail: "Forbidden." }, { status: 403 }),
    };
  }

  return auth;
}

export function getBackendApiBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api"
  ).replace(/\/+$/, "");
}

export function getBackendInternalApiSecret() {
  const secret = process.env.BACKEND_INTERNAL_API_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_INTERNAL_API_SECRET is required in production.");
  }

  return DEV_INTERNAL_API_SECRET;
}
