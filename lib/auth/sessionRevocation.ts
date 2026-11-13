/**
 * Server-enforced session revocation (founder-authorized P0, 2026-11-04; Atlas REVISE R1 on 1589800a). No schema change.
 *
 * Why: next-auth v4 re-encodes the JWT with `iat = now` on every /api/auth/session and getServerSession call, so the old
 * `iat < passwordChangedAt` check was defeated by a single refresh. R1 also removes every dependence on clock ORDER
 * (Atlas SR-01 pending commit, SR-06 host skew, SR-07 restored identity).
 *
 * Contract:
 *  - `User.passwordChangedAt` is the account's CREDENTIAL VERSION. At sign-in the token records `credStamp`, the exact
 *    value (epoch ms, 0 when null) read in the SAME row read that verified the credential or provider identity.
 *  - A session is current only if the account exists and is not disabled; role, school and platform-admin flag still
 *    match; the school is ACTIVE (unless platform admin); the stored version EQUALS credStamp; authTime is valid and
 *    the absolute lifetime has not passed; and, for a privileged account under enforced MFA, its assurance row, security
 *    version, expiry and break-glass window are still valid.
 *  - Every revocation (password/PIN change, reset, disable, role/school/platform change, sign-out-everywhere) calls
 *    {@link advanceSecurityStamp}: a compare-and-set inside the caller's transaction that always produces a NEW value.
 *    Concurrent changes serialize; the loser fails with 409 and its transaction rolls back.
 *  - Unknown or unreadable state is refused. A database error propagates; it never fails open.
 */
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { isPrivilegedAccount, isPrivilegedMfaEnforced } from "@/lib/auth/privilegedIdentity";
import { claimsShapeFailure, lifetimeExceeded } from "@/lib/auth/sessionClaims";

// Lifetimes and the claim-shape rules live in the Edge-safe module so middleware (U1) and this server check cannot drift.
export { PRIVILEGED_SESSION_MAX_AGE_MS, ORDINARY_SESSION_MAX_AGE_MS, sessionMaxAgeMs } from "@/lib/auth/sessionClaims";

/**
 * A disabled account's password hash. It is never a bcrypt hash, so it can never verify, and every provider and every
 * session refresh refuses an account carrying it. An empty hash is NOT disabled: Google-created accounts have one.
 */
export const DISABLED_CREDENTIAL = "!disabled";
export const isDisabledCredential = (hashedPwd: unknown): boolean =>
  typeof hashedPwd === "string" && hashedPwd.startsWith(DISABLED_CREDENTIAL);

export type SessionRevokedCode =
  | "SESSION_IDENTITY_MISSING"
  | "SESSION_AUTH_TIME_INVALID"
  | "SESSION_CREDENTIAL_STAMP_INVALID"
  | "SESSION_ACCOUNT_MISSING"
  | "SESSION_ACCOUNT_CHANGED"
  | "SESSION_SCHOOL_INACTIVE"
  | "SESSION_CREDENTIAL_CHANGED"
  | "SESSION_LIFETIME_EXCEEDED"
  | "SESSION_PRIVILEGED_ASSURANCE_INVALID";

export class SessionRevokedError extends Error {
  readonly status: 401 | 403;
  constructor(readonly code: SessionRevokedCode) {
    super(code === "SESSION_SCHOOL_INACTIVE" ? "School inactive" : "Session expired");
    this.name = "SessionRevokedError";
    this.status = code === "SESSION_SCHOOL_INACTIVE" ? 403 : 401;
  }
}
export class ConcurrentCredentialChangeError extends Error {
  readonly status = 409;
  constructor() { super("The account changed concurrently. Try again."); this.name = "ConcurrentCredentialChangeError"; }
}

export type SessionClaims = {
  id?: unknown;
  role?: unknown;
  schoolId?: unknown;
  isPlatformAdmin?: unknown;
  authTime?: unknown;
  credStamp?: unknown;
  authProvider?: unknown;
  securityVersion?: unknown;
  privilegedSessionId?: unknown;
};
type StampValue = Date | string | null | undefined;
export type FreshnessRow = {
  passwordChangedAt: StampValue;
  role: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
  school?: { status: string | null } | null;
  schoolStatus?: string | null;
} | null;
export type PrivilegedIdentityState = {
  securityVersion: number;
  breakGlassUntil: Date | null;
  sessions: Array<{ securityVersion: number; expiresAt: Date; revokedAt: Date | null }>;
} | null | undefined;

/** The credential version of a row (epoch ms; 0 when never set). NaN for an unreadable value. */
export const credentialStampOf = (row: { passwordChangedAt?: StampValue } | null | undefined): number =>
  row?.passwordChangedAt ? new Date(row.passwordChangedAt).getTime() : 0;

/** Pure decision: null when the session is current, otherwise why it is not. */
export function sessionFreshnessFailure(claims: SessionClaims, row: FreshnessRow, nowMs = Date.now()): SessionRevokedCode | null {
  const shape = claimsShapeFailure(claims, nowMs);
  if (shape) return shape;
  const credStamp = claims.credStamp as number;
  if (!row) return "SESSION_ACCOUNT_MISSING";
  if (row.role !== claims.role || row.schoolId !== (claims.schoolId ?? null) || row.isPlatformAdmin !== (claims.isPlatformAdmin === true)) {
    return "SESSION_ACCOUNT_CHANGED";
  }
  const schoolStatus = row.school !== undefined ? row.school?.status ?? null : row.schoolStatus ?? null;
  if (row.schoolId && !row.isPlatformAdmin && schoolStatus !== "ACTIVE") return "SESSION_SCHOOL_INACTIVE";
  if (credentialStampOf(row) !== credStamp) return "SESSION_CREDENTIAL_CHANGED";
  if (lifetimeExceeded(claims, nowMs)) return "SESSION_LIFETIME_EXCEEDED";
  return null;
}

/** Privileged assurance under enforced MFA: the session's own assurance row, security version, expiry and break-glass. */
export function privilegedAssuranceFailure(claims: SessionClaims, identity: PrivilegedIdentityState, nowMs = Date.now()): SessionRevokedCode | null {
  const assurance = identity?.sessions?.[0];
  if (
    !identity ||
    !assurance ||
    claims.securityVersion !== identity.securityVersion ||
    assurance.securityVersion !== identity.securityVersion ||
    assurance.revokedAt ||
    new Date(assurance.expiresAt).getTime() <= nowMs
  ) {
    return "SESSION_PRIVILEGED_ASSURANCE_INVALID";
  }
  if (claims.authProvider === "break-glass" && (!identity.breakGlassUntil || new Date(identity.breakGlassUntil).getTime() <= nowMs)) {
    return "SESSION_PRIVILEGED_ASSURANCE_INVALID";
  }
  return null;
}

type FreshnessReader = { user: { findFirst: (args: any) => Promise<any> } };

/**
 * The uncached, authoritative check run on EVERY jwt refresh, so it covers every getServerSession caller (direct ones
 * such as /api/moe/live included), not only requireUser. Throwing makes next-auth drop the session: /api/auth/session
 * clears the cookie, and getServerSession returns null.
 */
export async function assertTokenFresh(claims: SessionClaims, db: FreshnessReader = prisma, nowMs = Date.now()): Promise<void> {
  if (typeof claims.id !== "string" || !claims.id) throw new SessionRevokedError("SESSION_IDENTITY_MISSING");
  const privileged = isPrivilegedAccount({ role: typeof claims.role === "string" ? claims.role : null, isPlatformAdmin: claims.isPlatformAdmin === true })
    && isPrivilegedMfaEnforced();
  const row = await db.user.findFirst({
    // A disabled account reads as missing.
    where: { id: claims.id, OR: [{ hashedPwd: null }, { NOT: { hashedPwd: { startsWith: DISABLED_CREDENTIAL } } }] },
    select: {
      passwordChangedAt: true, role: true, schoolId: true, isPlatformAdmin: true, school: { select: { status: true } },
      ...(privileged ? { privilegedIdentity: { select: { id: true, securityVersion: true, breakGlassUntil: true,
        sessions: { where: { sessionId: typeof claims.privilegedSessionId === "string" ? claims.privilegedSessionId : "missing" }, take: 1,
          select: { securityVersion: true, expiresAt: true, revokedAt: true } } } } } : {}),
    },
  });
  const failure = sessionFreshnessFailure(claims, row, nowMs) ?? (privileged ? privilegedAssuranceFailure(claims, row?.privilegedIdentity, nowMs) : null);
  if (failure) throw new SessionRevokedError(failure);
}

type StampTx = { user: { findUnique: (args: any) => Promise<any>; updateMany: (args: any) => Promise<{ count: number }> } };

/**
 * Advance one account's credential version, revoking every session bound to the old one. Must run inside the same
 * interactive transaction as the change it accompanies. Compare-and-set: the new value is strictly after the old one
 * (whatever this host's clock says), and a concurrent change that got there first makes this throw, so the caller's
 * whole transaction rolls back instead of silently reusing a version.
 */
export async function advanceSecurityStamp(tx: StampTx, userId: string, now: Date = new Date()): Promise<Date> {
  const current = await tx.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  if (!current) throw Object.assign(new Error("Account not found"), { status: 404 });
  const previous: Date | null = current.passwordChangedAt ? new Date(current.passwordChangedAt) : null;
  const next = new Date(Math.max(now.getTime(), previous ? previous.getTime() + 1 : now.getTime()));
  const { count } = await tx.user.updateMany({ where: { id: userId, passwordChangedAt: current.passwordChangedAt ?? null }, data: { passwordChangedAt: next } });
  if (count !== 1) throw new ConcurrentCredentialChangeError();
  return next;
}

export const REVOCATION_REASONS = ["INCIDENT_CONTAINMENT", "CREDENTIAL_EXPOSURE", "ACCOUNT_DISABLED", "USER_REQUEST", "ADMIN_ACTION"] as const;
export type RevocationReason = (typeof REVOCATION_REASONS)[number];
export type RevocationInput = { userId: string; actorId: string; schoolId: string | null; reason: RevocationReason; disable?: boolean };

/** Sign out everywhere (and optionally disable) inside the caller's transaction, with the required audit row. */
export async function revokeAllSessionsInTx(tx: any, input: RevocationInput, now: Date = new Date()): Promise<void> {
  if (input.disable) await tx.user.update({ where: { id: input.userId }, data: { hashedPwd: DISABLED_CREDENTIAL } });
  await advanceSecurityStamp(tx, input.userId, now);
  await logAuditRequired({
    userId: input.actorId,
    action: input.disable ? "auth.account.disabled" : "auth.sessions.revoked_all",
    resourceType: "user",
    resourceId: input.userId,
    schoolId: input.schoolId,
    details: { reason: input.reason, disabled: input.disable === true },
  }, tx);
}

type RevocationDb = { $transaction: (fn: (tx: any) => Promise<unknown>) => Promise<unknown> };

/**
 * Audited per-account "sign out everywhere". With `disable`, the account is disabled: the disabled marker replaces the
 * password hash, and Credentials, Google, Auth0 and every session refresh refuse it until a new credential is issued.
 * The audit row is required and written in the same transaction: if it cannot be written, nothing changes.
 */
export async function revokeAllSessions(db: RevocationDb, input: RevocationInput, now: Date = new Date()): Promise<void> {
  await db.$transaction((tx) => revokeAllSessionsInTx(tx, input, now));
}

/**
 * Change an existing account's role, school or platform-admin flag together with a credential version advance, so a
 * later restoration of the old value can never resurrect an older session (Atlas SR-07). One transaction.
 */
export async function updateUserIdentity(
  db: RevocationDb,
  userId: string,
  data: { role?: any; schoolId?: string | null; isPlatformAdmin?: boolean },
): Promise<any> {
  return db.$transaction(async (tx) => {
    // Object literal (spread) so the Preview freeze scanner classifies this identity write; callers are frozen on Preview.
    const updated = await tx.user.update({ where: { id: userId }, data: { ...data } });
    await advanceSecurityStamp(tx, userId);
    return updated;
  });
}
