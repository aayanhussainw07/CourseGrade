import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/is-admin";

export { isAdminEmail };

export function getAdminEmails() {
  return new Set([ADMIN_EMAIL]);
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
  const secret = process.env.BACKEND_INTERNAL_API_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "BACKEND_INTERNAL_API_SECRET must be configured with at least 32 characters.",
    );
  }
  return secret;
}
