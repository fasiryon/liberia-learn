/**
 * Preview-only session policy (PV-06). Applies only to a deployed Preview/staging runtime; Production and runs
 * without a Vercel identity keep the existing 30-day session. Not MFA and not a substitute for SEC-R08.
 * The absolute bound is anchored at sign-in (authTime) and enforced in the NextAuth session callback, which every
 * server reader (getServerSession, getOptionalUser, requireUser) passes through.
 */
import { previewAutomationDisabled } from "@/lib/previewSideEffects";

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const PREVIEW_SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
// Tolerated clock skew between instances for a sign-in anchor.
const AUTH_TIME_SKEW_MS = 60_000;

export function isPreviewSessionPolicyActive(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return previewAutomationDisabled(env);
}

export function sessionMaxAgeSeconds(env: Readonly<Record<string, string | undefined>> = process.env): number {
  return isPreviewSessionPolicyActive(env) ? PREVIEW_SESSION_ABSOLUTE_SECONDS : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

/** A missing, malformed or future anchor fails closed in Preview. */
export function isPreviewSessionExpired(
  token: { authTime?: unknown },
  now = Date.now(),
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean {
  if (!isPreviewSessionPolicyActive(env)) return false;
  const authTime = token.authTime;
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return true;
  if (authTime > now + AUTH_TIME_SKEW_MS) return true;
  return now >= authTime + PREVIEW_SESSION_ABSOLUTE_SECONDS * 1000;
}
