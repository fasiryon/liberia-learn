/**
 * Server-enforced session revocation (founder-authorized P0, 2026-11-04). No schema change.
 *
 * Why: next-auth v4 re-encodes the JWT with `iat = now` on every /api/auth/session and getServerSession call, so the old
 * `iat < passwordChangedAt` check was defeated by a single refresh, and the jwt callback checked nothing.
 *
 * Contract:
 *  - `authTime` (epoch ms) is stamped once, when the credential is checked, BEFORE the account row is read. It is copied
 *    into the token at sign-in and never changes afterwards.
 *  - A session is current only if: the account exists; role, school and platform-admin flag still match; the school is
 *    ACTIVE (unless platform admin); authTime is a finite number not in the future; authTime is STRICTLY later than
 *    passwordChangedAt (a tie revokes); and the absolute lifetime for the role has not passed.
 *  - Revocation = advancing `User.passwordChangedAt`. Every writer uses {@link stampCredentialChange}, which only moves it
 *    forward, so concurrent changes converge on the latest one and cannot reopen an earlier window.
 *  - Unknown or unreadable state is refused. A database error propagates; it never fails open.
 */
import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { isPrivilegedAccount } from "@/lib/auth/privilegedIdentity";

export const PRIVILEGED_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
/** FOUNDER DECISION PENDING: the absolute lifetime of ordinary (student, teacher, guardian) sessions. Default 30 days. */
export const ORDINARY_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Tolerated clock skew between application instances for a freshly stamped authTime. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export type SessionRevokedCode =
  | "SESSION_IDENTITY_MISSING"
  | "SESSION_AUTH_TIME_INVALID"
  | "SESSION_ACCOUNT_MISSING"
  | "SESSION_ACCOUNT_CHANGED"
  | "SESSION_SCHOOL_INACTIVE"
  | "SESSION_CREDENTIAL_CHANGED"
  | "SESSION_LIFETIME_EXCEEDED";

export class SessionRevokedError extends Error {
  readonly status: 401 | 403;
  constructor(readonly code: SessionRevokedCode) {
    super(code === "SESSION_SCHOOL_INACTIVE" ? "School inactive" : "Session expired");
    this.name = "SessionRevokedError";
    this.status = code === "SESSION_SCHOOL_INACTIVE" ? 403 : 401;
  }
}

export type SessionClaims = {
  id?: unknown;
  role?: unknown;
  schoolId?: unknown;
  isPlatformAdmin?: unknown;
  authTime?: unknown;
};
export type FreshnessRow = {
  passwordChangedAt: Date | string | null;
  role: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
  school?: { status: string | null } | null;
  schoolStatus?: string | null;
} | null;

export const sessionMaxAgeMs = (claims: { role?: unknown; isPlatformAdmin?: unknown }) =>
  isPrivilegedAccount({ role: typeof claims.role === "string" ? claims.role : null, isPlatformAdmin: claims.isPlatformAdmin === true })
    ? PRIVILEGED_SESSION_MAX_AGE_MS
    : ORDINARY_SESSION_MAX_AGE_MS;

/** Pure decision: null when the session is current, otherwise why it is not. */
export function sessionFreshnessFailure(claims: SessionClaims, row: FreshnessRow, nowMs = Date.now()): SessionRevokedCode | null {
  if (typeof claims.id !== "string" || !claims.id) return "SESSION_IDENTITY_MISSING";
  const authTime = claims.authTime;
  if (typeof authTime !== "number" || !Number.isFinite(authTime) || authTime <= 0 || authTime > nowMs + FUTURE_SKEW_MS) return "SESSION_AUTH_TIME_INVALID";
  if (!row) return "SESSION_ACCOUNT_MISSING";
  if (row.role !== claims.role || row.schoolId !== (claims.schoolId ?? null) || row.isPlatformAdmin !== (claims.isPlatformAdmin === true)) {
    return "SESSION_ACCOUNT_CHANGED";
  }
  const schoolStatus = row.school !== undefined ? row.school?.status ?? null : row.schoolStatus ?? null;
  if (row.schoolId && !row.isPlatformAdmin && schoolStatus !== "ACTIVE") return "SESSION_SCHOOL_INACTIVE";
  if (row.passwordChangedAt) {
    const changedAt = new Date(row.passwordChangedAt).getTime();
    if (!Number.isFinite(changedAt) || authTime <= changedAt) return "SESSION_CREDENTIAL_CHANGED";
  }
  if (nowMs - authTime > sessionMaxAgeMs(claims)) return "SESSION_LIFETIME_EXCEEDED";
  return null;
}

type FreshnessReader = { user: { findUnique: (args: any) => Promise<any> } };

/**
 * The uncached check run on EVERY jwt refresh. Throwing makes next-auth drop the session: /api/auth/session clears the
 * cookie, and getServerSession returns null, so requireUser answers 401.
 */
export async function assertTokenFresh(claims: SessionClaims, db: FreshnessReader = prisma, nowMs = Date.now()): Promise<void> {
  if (typeof claims.id !== "string" || !claims.id) throw new SessionRevokedError("SESSION_IDENTITY_MISSING");
  const row = await db.user.findUnique({
    where: { id: claims.id },
    select: { passwordChangedAt: true, role: true, schoolId: true, isPlatformAdmin: true, school: { select: { status: true } } },
  });
  const failure = sessionFreshnessFailure(claims, row, nowMs);
  if (failure) throw new SessionRevokedError(failure);
}

type StampWriter = { user: { updateMany: (args: any) => any } };

/**
 * Revoke every session of one account issued at or before `at`: move passwordChangedAt forward to `at`, never back.
 * Returns the Prisma operation so it can join a batch `$transaction([...])` or run inside an interactive one.
 */
export function stampCredentialChange<T extends StampWriter>(db: T, userId: string, at: Date = new Date()): ReturnType<T["user"]["updateMany"]> {
  return db.user.updateMany({
    where: { id: userId, OR: [{ passwordChangedAt: null }, { passwordChangedAt: { lt: at } }] },
    data: { passwordChangedAt: at },
  });
}

export const REVOCATION_REASONS = ["INCIDENT_CONTAINMENT", "CREDENTIAL_EXPOSURE", "ACCOUNT_DISABLED", "USER_REQUEST", "ADMIN_ACTION"] as const;
export type RevocationReason = (typeof REVOCATION_REASONS)[number];

type RevocationDb = { $transaction: (fn: (tx: any) => Promise<unknown>) => Promise<unknown> };

/**
 * Audited per-account "sign out everywhere". With `disable`, the credential is also made unusable (an empty hash never
 * signs in), so the account cannot start a new password session either. The audit row is written in the same
 * transaction and is required: if it cannot be written, nothing changes.
 */
export async function revokeAllSessions(
  db: RevocationDb,
  input: { userId: string; actorId: string; schoolId: string | null; reason: RevocationReason; disable?: boolean },
  at: Date = new Date(),
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (input.disable) await tx.user.update({ where: { id: input.userId }, data: { hashedPwd: "" } });
    await stampCredentialChange(tx, input.userId, at);
    await logAuditRequired({
      userId: input.actorId,
      action: input.disable ? "auth.account.disabled" : "auth.sessions.revoked_all",
      resourceType: "user",
      resourceId: input.userId,
      schoolId: input.schoolId,
      details: { reason: input.reason, disabled: input.disable === true },
    }, tx);
  });
}
