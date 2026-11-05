/**
 * Edge-safe session CLAIM checks (U1, founder-authorized 2026-11-05). No database, no Node-only imports: middleware
 * runs on the Edge runtime (Next 14) and can only see the signed token.
 *
 * What this can decide: a token is structurally a current-contract session (string id, numeric authTime and credStamp)
 * and is within its role's absolute lifetime. What it CANNOT decide: revocation (credential version, disable, role or
 * school change, privileged assurance). That stays server-side in `assertTokenFresh` (lib/auth/sessionRevocation.ts),
 * which runs on every getServerSession/requireUser call; `enforceAdmittedSession` closes the page gap between the two.
 */
import { isPrivilegedAccount } from "@/lib/auth/privilegedIdentity";

export const PRIVILEGED_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
/** Founder decision 2026-11-04: ordinary (student, teacher, guardian) sessions keep a 30-day absolute lifetime. */
export const ORDINARY_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Tolerated clock skew for a freshly stamped authTime; it bounds only the absolute lifetime. */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Set by middleware on every request it admitted on a token. Middleware always strips an inbound value. */
export const SESSION_ADMITTED_HEADER = "x-ll-session-admitted";

export type SessionClaimsCode =
  | "SESSION_IDENTITY_MISSING"
  | "SESSION_AUTH_TIME_INVALID"
  | "SESSION_CREDENTIAL_STAMP_INVALID"
  | "SESSION_LIFETIME_EXCEEDED";

type Claims = { id?: unknown; role?: unknown; isPlatformAdmin?: unknown; authTime?: unknown; credStamp?: unknown };

export const sessionMaxAgeMs = (claims: { role?: unknown; isPlatformAdmin?: unknown }) =>
  isPrivilegedAccount({ role: typeof claims.role === "string" ? claims.role : null, isPlatformAdmin: claims.isPlatformAdmin === true })
    ? PRIVILEGED_SESSION_MAX_AGE_MS
    : ORDINARY_SESSION_MAX_AGE_MS;

/** Identity, authTime and credStamp shape. Null when well-formed. */
export function claimsShapeFailure(claims: Claims, nowMs = Date.now()): SessionClaimsCode | null {
  if (typeof claims.id !== "string" || !claims.id) return "SESSION_IDENTITY_MISSING";
  const authTime = claims.authTime;
  if (typeof authTime !== "number" || !Number.isFinite(authTime) || authTime <= 0 || authTime > nowMs + FUTURE_SKEW_MS) return "SESSION_AUTH_TIME_INVALID";
  const credStamp = claims.credStamp;
  if (typeof credStamp !== "number" || !Number.isFinite(credStamp) || credStamp < 0) return "SESSION_CREDENTIAL_STAMP_INVALID";
  return null;
}

/** Absolute lifetime by role (assumes a well-formed authTime). */
export const lifetimeExceeded = (claims: Claims, nowMs = Date.now()): boolean =>
  nowMs - (claims.authTime as number) > sessionMaxAgeMs(claims);

/** Claims-only decision used by middleware: null when the token may proceed to the server-side checks. */
export function sessionClaimsFailure(claims: Claims, nowMs = Date.now()): SessionClaimsCode | null {
  return claimsShapeFailure(claims, nowMs) ?? (lifetimeExceeded(claims, nowMs) ? "SESSION_LIFETIME_EXCEEDED" : null);
}
