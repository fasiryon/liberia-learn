/**
 * Session revocation (founder-authorized P0, 2026-11-04; CoS COS-DISPATCH-20261104-FOUNDER-AUTH-CREDENTIAL-AND-SESSION;
 * T1 findings S1-S3 in T1-AUTH-SESSION-INVALIDATION-FINDINGS-20261104.md).
 *
 * S1: next-auth re-encodes the JWT with iat = now on EVERY /api/auth/session and getServerSession, and the jwt callback
 * checked nothing, so `iat < passwordChangedAt` was bypassed by one refresh. The repair stamps an immutable authTime at
 * sign-in (captured BEFORE the credential is read) and checks it, uncached, on every jwt refresh and in requireUser.
 * No schema change: revocation is `passwordChangedAt`, made monotonic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    inviteToken: { findFirst: vi.fn(), update: vi.fn() },
    privilegedSessionAssurance: { create: vi.fn() },
    auditLog: { create: vi.fn(() => ({ catch: () => null })) },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: (_key: string, _ttl: number, load: () => unknown) => load() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => true), logAuditRequired: vi.fn(async () => undefined) }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAuditRequired } from "@/lib/audit";
import { authOptions, authorizeCredentials, requireRole, requireUser } from "@/lib/auth";
import {
  ORDINARY_SESSION_MAX_AGE_MS,
  PRIVILEGED_SESSION_MAX_AGE_MS,
  revokeAllSessions,
  stampCredentialChange,
} from "@/lib/auth/sessionRevocation";

const db = prisma as unknown as {
  user: Record<"findUnique" | "findFirst" | "update" | "updateMany" | "create", ReturnType<typeof vi.fn>>;
  inviteToken: Record<"findFirst" | "update", ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
};
const session = vi.mocked(getServerSession);
const compare = vi.mocked((bcrypt as unknown as { compare: (...a: unknown[]) => Promise<boolean> }).compare);

const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const HOUR = 3_600_000;
const teacherRow = (passwordChangedAt: Date | null, extra: Record<string, unknown> = {}) =>
  ({ passwordChangedAt, role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" }, ...extra });
const teacherToken = (authTime: unknown, extra: Record<string, unknown> = {}) =>
  ({ id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, iat: Math.floor(NOW / 1000), authTime, ...extra });
/** The jwt callback as next-auth calls it on a refresh (/api/auth/session or getServerSession): no user, no account. */
const refresh = (token: Record<string, unknown>) => authOptions.callbacks!.jwt!({ token, user: undefined, account: null } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
});

describe("password change invalidates previously issued sessions", () => {
  it("RED: a refresh of a token authenticated before the change is refused (cookie cleared by next-auth)", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(new Date(NOW - HOUR)));
    await expect(refresh(teacherToken(NOW - 2 * HOUR))).rejects.toMatchObject({ status: 401 });
  });
  it("RED (S1): a freshly re-issued iat does not launder the session; authTime decides", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(new Date(NOW - HOUR)));
    // iat = now (re-encoded by a refresh after the change), but the learner authenticated before it.
    await expect(refresh(teacherToken(NOW - 2 * HOUR, { iat: Math.floor(NOW / 1000) }))).rejects.toMatchObject({ status: 401 });
    session.mockResolvedValue({ user: teacherToken(NOW - 2 * HOUR, { iat: Math.floor(NOW / 1000) }) } as never);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("RED: the freshness read on refresh is uncached and by account id", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    await refresh(teacherToken(NOW - HOUR));
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "teacher-1" } }));
  });
});

describe("disabled accounts cannot use previously issued sessions", () => {
  it("RED: disabling makes the credential unusable and revokes every session, audited in one transaction", async () => {
    const tx = { user: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) } };
    db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    await revokeAllSessions(prisma as never, { userId: "teacher-1", actorId: "admin-1", schoolId: "school-1", reason: "ACCOUNT_DISABLED", disable: true });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "teacher-1" }, data: { hashedPwd: "" } });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { passwordChangedAt: new Date(NOW) } }));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1", resourceId: "teacher-1", action: "auth.account.disabled" }), tx);
  });
  it("RED: after disabling, the old session is refused and the password no longer signs in", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(new Date(NOW)));
    await expect(refresh(teacherToken(NOW - 60_000))).rejects.toMatchObject({ status: 401 });
    db.user.findFirst.mockResolvedValue({ id: "teacher-1", email: "t@x.lr", role: "TEACHER", hashedPwd: "", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" } });
    expect(await authorizeCredentials({ email: "t@x.lr", password: "anything" })).toBeNull();
  });
  it("RED: a deactivated teacher cannot sign in with Google either", async () => {
    db.user.findUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER", googleId: "g-1", schoolId: "school-1", school: { googleSsoEnabled: true },
      TeacherProfile: { permissions: { active: false } } });
    const result = await authOptions.callbacks!.signIn!({ user: { id: "g-1", email: "t@x.lr" }, account: { provider: "google" } } as never);
    expect(result).toBe(false);
  });
});

describe("password reset cannot leave an existing privileged session active", () => {
  it("RED: an MOE official's pre-reset session is refused on refresh", async () => {
    db.user.findUnique.mockResolvedValue({ passwordChangedAt: new Date(NOW - 60_000), role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false, school: null });
    await expect(refresh({ id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false, authTime: NOW - HOUR })).rejects.toMatchObject({ status: 401 });
  });
  it("RED: with MFA enforced, requireUser refuses it even though its assurance row is still valid", async () => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    session.mockResolvedValue({ user: { id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false, iat: Math.floor(NOW / 1000), authTime: NOW - HOUR,
      authProvider: "auth0", mfaVerifiedAt: NOW - HOUR, assuranceExpiresAt: NOW + HOUR, securityVersion: 1, privilegedSessionId: "ps-1" } } as never);
    db.user.findUnique.mockResolvedValue({ role: "MOE_OFFICIAL", passwordChangedAt: new Date(NOW - 60_000), schoolId: null, isPlatformAdmin: false, school: null,
      privilegedIdentity: { id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [{ securityVersion: 1, expiresAt: new Date(NOW + HOUR), revokedAt: null }] } });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("a newly authenticated session works after credential rotation", () => {
  it("RED: authorize stamps authTime BEFORE reading the credential, so a concurrent change always wins", async () => {
    let readAt = 0;
    db.user.findFirst.mockImplementation(async () => { vi.setSystemTime(NOW + 5); readAt = Date.now();
      return { id: "teacher-1", email: "t@x.lr", role: "TEACHER", hashedPwd: "h", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" } }; });
    compare.mockResolvedValue(true);
    const user = await authorizeCredentials({ email: "t@x.lr", password: "new" }) as { authTime: number };
    expect(user.authTime).toBe(NOW);
    expect(user.authTime).toBeLessThan(readAt);
  });
  it("RED: sign-in copies authTime into the token; a refresh then a protected call succeed", async () => {
    vi.setSystemTime(NOW + HOUR);
    const token = await authOptions.callbacks!.jwt!({ token: {}, user: { id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, authTime: NOW }, account: { provider: "credentials" } } as never);
    expect(token).toMatchObject({ authTime: NOW });
    db.user.findUnique.mockResolvedValue(teacherRow(new Date(NOW - 1)));
    await expect(refresh(token as Record<string, unknown>)).resolves.toMatchObject({ id: "teacher-1", authTime: NOW });
    session.mockResolvedValue({ user: { ...teacherToken(NOW) } } as never);
    await expect(requireRole("TEACHER")).resolves.toMatchObject({ id: "teacher-1" });
  });
  it("RED: a later refresh never moves authTime", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    const out = await refresh(teacherToken(NOW - HOUR, { authTime: NOW - HOUR })) as { authTime: number };
    expect(out.authTime).toBe(NOW - HOUR);
  });
});

describe("existing role, school and cross-school boundaries remain intact", () => {
  it.each([
    ["role changed", { role: "STUDENT" }],
    ["moved to another school", { schoolId: "school-2" }],
    ["platform-admin flag changed", { isPlatformAdmin: true }],
    ["school inactive", { school: { status: "SUSPENDED" } }],
  ])("RED: refresh refuses when %s", async (_label, change) => {
    db.user.findUnique.mockResolvedValue(teacherRow(null, change));
    await expect(refresh(teacherToken(NOW - HOUR))).rejects.toMatchObject({ status: expect.any(Number) });
  });
  it("requireRole still refuses the wrong role with 403", async () => {
    session.mockResolvedValue({ user: teacherToken(NOW - HOUR) } as never);
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    await expect(requireRole("ADMIN")).rejects.toMatchObject({ status: 403 });
  });
});

describe("unknown or invalid revocation state fails safely", () => {
  it.each([
    ["no authTime (a token issued before this repair)", teacherToken(undefined)],
    ["a non-numeric authTime", teacherToken("yesterday")],
    ["a future authTime", teacherToken(NOW + HOUR)],
    ["no account id", { ...teacherToken(NOW - HOUR), id: undefined }],
  ])("RED: refresh refuses %s", async (_label, token) => {
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    await expect(refresh(token as Record<string, unknown>)).rejects.toMatchObject({ status: 401 });
  });
  it("RED: an account that no longer exists is refused", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(refresh(teacherToken(NOW - HOUR))).rejects.toMatchObject({ status: 401 });
  });
  it("RED: a database failure during refresh refuses the session (no fail-open)", async () => {
    db.user.findUnique.mockRejectedValue(new Error("db down"));
    await expect(refresh(teacherToken(NOW - HOUR))).rejects.toBeDefined();
  });
  it("RED: requireUser refuses a session without authTime even if the database is healthy", async () => {
    session.mockResolvedValue({ user: teacherToken(undefined) } as never);
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("absolute session lifetime", () => {
  it("RED: privileged sessions end after 8 hours; ordinary ones after the named limit", async () => {
    expect(PRIVILEGED_SESSION_MAX_AGE_MS).toBe(8 * HOUR);
    expect(ORDINARY_SESSION_MAX_AGE_MS).toBe(30 * 24 * HOUR);
    db.user.findUnique.mockResolvedValue({ passwordChangedAt: null, role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" } });
    await expect(refresh({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false, authTime: NOW - 8 * HOUR - 1 })).rejects.toMatchObject({ status: 401 });
    await expect(refresh({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false, authTime: NOW - 7 * HOUR })).resolves.toBeDefined();
    db.user.findUnique.mockResolvedValue(teacherRow(null));
    await expect(refresh(teacherToken(NOW - ORDINARY_SESSION_MAX_AGE_MS - 1))).rejects.toMatchObject({ status: 401 });
    await expect(refresh(teacherToken(NOW - ORDINARY_SESSION_MAX_AGE_MS + HOUR))).resolves.toBeDefined();
  });
});

describe("concurrent password changes are deterministic", () => {
  it("RED: the revocation stamp only ever moves forward (monotonic), never back to an earlier change", () => {
    const user = { updateMany: vi.fn((args: unknown) => args) };
    const at = new Date(NOW);
    expect(stampCredentialChange({ user } as never, "teacher-1", at)).toEqual({
      where: { id: "teacher-1", OR: [{ passwordChangedAt: null }, { passwordChangedAt: { lt: at } }] },
      data: { passwordChangedAt: at },
    });
  });
  it("RED: a session that authenticated at the same millisecond as a change is refused (ties revoke)", async () => {
    db.user.findUnique.mockResolvedValue(teacherRow(new Date(NOW - HOUR)));
    await expect(refresh(teacherToken(NOW - HOUR))).rejects.toMatchObject({ status: 401 });
  });
});
