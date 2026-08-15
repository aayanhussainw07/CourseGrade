// Client-safe admin check for gating UI only.
// Real authorization is enforced server-side in lib/server-auth.ts + the backend.
// Hardcoded sole admin — not env-overridable.
export const ADMIN_EMAIL = "aayanhussainw07@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase() === ADMIN_EMAIL);
}
