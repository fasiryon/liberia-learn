import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_ADMITTED_HEADER } from "@/lib/auth/sessionClaims";

/**
 * U1 page gate. Middleware admitted this request on a signed token (claims only). If the authoritative server session
 * is nevertheless null — revoked, disabled, changed, or the database check failed — the page must not render: send
 * the caller to sign in. Requests middleware did not admit on a token (public paths) are never redirected here.
 * Call it from a portal layout with the result of getOptionalUser().
 */
export function enforceAdmittedSession(user: unknown, signInPath = "/login?reason=session_ended"): void {
  if (user) return;
  if (headers().get(SESSION_ADMITTED_HEADER) !== "1") return;
  redirect(signInPath);
}
