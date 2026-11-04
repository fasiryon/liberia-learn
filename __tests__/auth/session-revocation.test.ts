/**
 * Session revocation (founder-authorized P0, 2026-11-04; CoS COS-DISPATCH-20261104-FOUNDER-AUTH-CREDENTIAL-AND-SESSION;
 * T1 findings S1-S3; Atlas REVISE SR-01..SR-07 on 1589800a, artifacts/atlas-acceptance-20261104/session-346f6591).
 *
 * Contract (R1): revocation is a VERSION, not a clock ordering. At sign-in the token records `credStamp`, the exact
 * `passwordChangedAt` value (ms, 0 when null) read in the SAME row read that verified the credential. A session is
 * current only while the stored value still equals it. Every revocation advances the value by compare-and-set, so a
 * login that verified the old credential before a change committed, an ahead or behind host clock, and a restored role
 * or school can never keep an old session alive. `authTime` remains only for the absolute lifetime.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    inviteToken: { findFirst: vi.fn(), update: vi.fn() },
    privilegedIdentity: { upsert: vi.fn() },
    privilegedSessionAssurance: { create: vi.fn() },
    auditLog: { create: vi.fn(() => ({ catch: () => null })) },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: vi.fn((_key: string, _ttl: number, load: () => unknown) => load()) }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => true), logAuditRequired: vi.fn(async () => undefined) }));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAuditRequired } from "@/lib/audit";
import { withRedisCache } from "@/lib/cache/redisCache";
import { authOptions, authorizeCredentials, requireRole, requireUser } from "@/lib/auth";
import {
  advanceSecurityStamp,
  ConcurrentCredentialChangeError,
  DISABLED_CREDENTIAL,
  isDisabledCredential,
  ORDINARY_SESSION_MAX_AGE_MS,
  PRIVILEGED_SESSION_MAX_AGE_MS,
  revokeAllSessions,
} from "@/lib/auth/sessionRevocation";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { user: Record<"findUnique" | "findFirst" | "update" | "updateMany" | "create", Fn>; $transaction: Fn };
const session = vi.mocked(getServerSession);
const compare = vi.mocked((bcrypt as unknown as { compare: (...a: unknown[]) => Promise<boolean> }).compare);

const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const HOUR = 3_600_000;
const STAMP = NOW - 10 * HOUR; // the credential version the session authenticated against
const row = (passwordChangedAt: Date | null, extra: Record<string, unknown> = {}) =>
  ({ passwordChangedAt, role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, school: { status: "ACTIVE" }, ...extra });
const token = (extra: Record<string, unknown> = {}) =>
  ({ id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, iat: Math.floor(NOW / 1000), authTime: NOW - HOUR, credStamp: STAMP, ...extra });
/** The jwt callback as next-auth calls it on a refresh (/api/auth/session or getServerSession): no user, no account. */
const refresh = (t: Record<string, unknown>) => authOptions.callbacks!.jwt!({ token: t, user: undefined, account: null } as never);
const loginRow = (extra: Record<string, unknown> = {}) =>
  ({ id: "teacher-1", email: "t@x.lr", role: "TEACHER", hashedPwd: "$2a$10$hash", schoolId: "school-1", isPlatformAdmin: false, passwordChangedAt: new Date(STAMP), school: { status: "ACTIVE" }, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
});

describe("password change invalidates previously issued sessions", () => {
  it("a refresh is accepted while the stored credential version is unchanged", async () => {
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP)));
    await expect(refresh(token())).resolves.toMatchObject({ credStamp: STAMP });
  });
  it("RED (S1): a refresh after the version advanced is refused, whatever iat says", async () => {
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP + 1)));
    await expect(refresh(token({ iat: Math.floor(NOW / 1000) }))).rejects.toMatchObject({ status: 401 });
  });
  it("RED: the authoritative refresh read is uncached, by id, and excludes disabled credentials", async () => {
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP)));
    await refresh(token());
    expect(withRedisCache).not.toHaveBeenCalled();
    const where = db.user.findFirst.mock.calls[0][0].where;
    expect(where.id).toBe("teacher-1");
    expect(JSON.stringify(where)).toContain(DISABLED_CREDENTIAL);
  });
  it("RED: requireUser refuses a session whose version no longer matches", async () => {
    session.mockResolvedValue({ user: token() } as never);
    db.user.findUnique.mockResolvedValue(row(new Date(STAMP + 1)));
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("SR-01: a login that verified the old credential before a change committed", () => {
  it("RED: binds credStamp to the row read that verified the password, so the commit revokes it", async () => {
    db.user.findFirst.mockResolvedValue(loginRow()); // old hash + old version, read together
    compare.mockResolvedValue(true);
    const user = await authorizeCredentials({ email: "t@x.lr", password: "old" }) as { credStamp: number };
    expect(user.credStamp).toBe(STAMP);
    const t = await authOptions.callbacks!.jwt!({ token: {}, user: user as never, account: { provider: "credentials" } } as never);
    expect(t).toMatchObject({ credStamp: STAMP });
    // The change commits a NEW version afterwards (any value, any host clock): the session dies.
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP - 5 * HOUR)));
    await expect(refresh(t as Record<string, unknown>)).rejects.toMatchObject({ status: 401 });
  });
});

describe("SR-06: revocation does not depend on host clocks", () => {
  it("RED: an authTime ahead of this host does not outlive a version change", async () => {
    db.user.findFirst.mockResolvedValue(row(new Date(NOW)));
    await expect(refresh(token({ authTime: NOW + 60_000, credStamp: STAMP }))).rejects.toMatchObject({ status: 401 });
  });
  it("RED: the new version always differs from the old one, even if this host's clock is behind it", async () => {
    const tx = { user: { findUnique: vi.fn(async () => ({ passwordChangedAt: new Date(NOW + HOUR) })), updateMany: vi.fn(async () => ({ count: 1 })) } };
    const next = await advanceSecurityStamp(tx as never, "teacher-1");
    expect(next.getTime()).toBe(NOW + HOUR + 1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: "teacher-1", passwordChangedAt: new Date(NOW + HOUR) }, data: { passwordChangedAt: new Date(NOW + HOUR + 1) } });
  });
});

describe("concurrent credential changes are serialized (compare-and-set)", () => {
  it("RED: a change that lost the race fails instead of silently reusing a version", async () => {
    const tx = { user: { findUnique: vi.fn(async () => ({ passwordChangedAt: null })), updateMany: vi.fn(async () => ({ count: 0 })) } };
    await expect(advanceSecurityStamp(tx as never, "teacher-1")).rejects.toBeInstanceOf(ConcurrentCredentialChangeError);
    expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: "teacher-1", passwordChangedAt: null }, data: { passwordChangedAt: new Date(NOW) } });
  });
  it("RED: an unknown account cannot be stamped", async () => {
    const tx = { user: { findUnique: vi.fn(async () => null), updateMany: vi.fn() } };
    await expect(advanceSecurityStamp(tx as never, "nobody")).rejects.toMatchObject({ status: 404 });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("SR-02: a disabled account is refused by every provider and every session", () => {
  const tx = () => ({ user: { update: vi.fn(async () => ({})), findUnique: vi.fn(async () => ({ passwordChangedAt: new Date(STAMP) })), updateMany: vi.fn(async () => ({ count: 1 })) } });
  it("RED: disabling writes the disabled marker, advances the version and requires its audit, in one transaction", async () => {
    const t = tx();
    db.$transaction.mockImplementation(async (fn: (x: unknown) => unknown) => fn(t));
    await revokeAllSessions(prisma as never, { userId: "teacher-1", actorId: "admin-1", schoolId: "school-1", reason: "ACCOUNT_DISABLED", disable: true });
    expect(t.user.update).toHaveBeenCalledWith({ where: { id: "teacher-1" }, data: { hashedPwd: DISABLED_CREDENTIAL } });
    expect(t.user.updateMany).toHaveBeenCalled();
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1", resourceId: "teacher-1", action: "auth.account.disabled" }), t);
  });
  it("RED: the marker is distinct from an empty Google-account hash", () => {
    expect(isDisabledCredential(DISABLED_CREDENTIAL)).toBe(true);
    expect(isDisabledCredential("")).toBe(false);
    expect(isDisabledCredential(null)).toBe(false);
    expect(isDisabledCredential("$2a$10$hash")).toBe(false);
  });
  it("RED: password sign-in refuses a disabled account without calling bcrypt", async () => {
    db.user.findFirst.mockResolvedValue(loginRow({ hashedPwd: DISABLED_CREDENTIAL }));
    expect(await authorizeCredentials({ email: "t@x.lr", password: "x" })).toBeNull();
    expect(compare).not.toHaveBeenCalled();
  });
  it("RED: Google sign-in refuses a disabled account even when its teacher profile is still active", async () => {
    db.user.findUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER", googleId: "g-1", schoolId: "school-1", hashedPwd: DISABLED_CREDENTIAL,
      passwordChangedAt: new Date(STAMP), school: { googleSsoEnabled: true }, TeacherProfile: { permissions: { active: true } } });
    expect(await authOptions.callbacks!.signIn!({ user: { id: "g-1", email: "t@x.lr" }, account: { provider: "google" } } as never)).toBe(false);
  });
  it("RED: Auth0 sign-in refuses a disabled privileged account", async () => {
    const claims = Buffer.from(JSON.stringify({ sub: "auth0|1", email_verified: true, amr: ["mfa"], acr: "http://schemas.openid.net/pape/policies/2007/06/multi-factor", auth_time: Math.floor(NOW / 1000) })).toString("base64url");
    db.user.findUnique.mockResolvedValue({ id: "moe-1", email: "m@x.lr", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false, hashedPwd: DISABLED_CREDENTIAL,
      passwordChangedAt: new Date(STAMP), privilegedIdentity: null });
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    // signIn is typed Awaitable<string | boolean> (next-auth 4.24.15), so normalize to a Promise before catching.
    const result = await Promise.resolve(authOptions.callbacks!.signIn!({ user: { id: "auth0|1", email: "m@x.lr" }, account: { provider: "auth0", id_token: `${header}.${claims}.sig` } } as never))
      .catch((e: unknown) => e);
    expect(result).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled(); // refused before any privileged identity is enrolled
  });
  it("still refuses a deactivated teacher's Google sign-in", async () => {
    db.user.findUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER", googleId: "g-1", schoolId: "school-1", hashedPwd: "", passwordChangedAt: null,
      school: { googleSsoEnabled: true }, TeacherProfile: { permissions: { active: false } } });
    expect(await authOptions.callbacks!.signIn!({ user: { id: "g-1", email: "t@x.lr" }, account: { provider: "google" } } as never)).toBe(false);
  });
  it("RED: a Google sign-in binds the version it read", async () => {
    db.user.findUnique.mockResolvedValue({ id: "teacher-1", role: "TEACHER", googleId: "g-1", schoolId: "school-1", hashedPwd: "", passwordChangedAt: new Date(STAMP),
      school: { googleSsoEnabled: true }, TeacherProfile: { permissions: {} } });
    const user: Record<string, unknown> = { id: "g-1", email: "t@x.lr" };
    expect(await authOptions.callbacks!.signIn!({ user, account: { provider: "google" } } as never)).toBe(true);
    expect(user.credStamp).toBe(STAMP);
  });
});

describe("SR-03: privileged assurance is enforced on every session refresh (direct getServerSession callers too)", () => {
  const moeToken = (extra: Record<string, unknown> = {}) => token({ id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, authProvider: "auth0", mfaVerifiedAt: NOW - 60_000,
    assuranceExpiresAt: NOW + HOUR, securityVersion: 1, privilegedSessionId: "ps-1", ...extra });
  const moeRow = (identity: unknown) => ({ ...row(new Date(STAMP), { role: "MOE_OFFICIAL", schoolId: null, school: null }), privilegedIdentity: identity });
  const assurance = (extra: Record<string, unknown> = {}) => ({ securityVersion: 1, expiresAt: new Date(NOW + HOUR), revokedAt: null, ...extra });
  beforeEach(() => { process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true"; });
  it("accepts a current MFA assurance", async () => {
    db.user.findFirst.mockResolvedValue(moeRow({ id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [assurance()] }));
    await expect(refresh(moeToken())).resolves.toBeDefined();
  });
  it.each([
    ["a revoked assurance", { id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [assurance({ revokedAt: new Date(NOW - 1) })] }],
    ["an advanced security version", { id: "pi-1", securityVersion: 2, breakGlassUntil: null, sessions: [assurance()] }],
    ["an expired assurance", { id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [assurance({ expiresAt: new Date(NOW - 1) })] }],
    ["a missing assurance row", { id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [] }],
    ["no privileged identity", null],
  ])("RED: refuses %s on refresh", async (_label, identity) => {
    db.user.findFirst.mockResolvedValue(moeRow(identity));
    await expect(refresh(moeToken())).rejects.toMatchObject({ status: 401 });
  });
  it("RED: refuses an expired break-glass window on refresh", async () => {
    db.user.findFirst.mockResolvedValue(moeRow({ id: "pi-1", securityVersion: 1, breakGlassUntil: new Date(NOW - 1), sessions: [assurance()] }));
    await expect(refresh(moeToken({ authProvider: "break-glass" }))).rejects.toMatchObject({ status: 401 });
  });
  it("RED: requests the assurance row for this session only", async () => {
    db.user.findFirst.mockResolvedValue(moeRow({ id: "pi-1", securityVersion: 1, breakGlassUntil: null, sessions: [assurance()] }));
    await refresh(moeToken());
    expect(JSON.stringify(db.user.findFirst.mock.calls[0][0].select)).toContain("ps-1");
  });
});

describe("SR-07: restoring a role, school or platform flag never resurrects an old session", () => {
  it("RED: identity writers advance the version, so the restored state still refuses the old token", async () => {
    // Moved away and back: each move advanced the version, so the stored version differs from the token's.
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP + 2)));
    await expect(refresh(token())).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    ["role changed", { role: "STUDENT" }],
    ["moved to another school", { schoolId: "school-2" }],
    ["platform-admin flag changed", { isPlatformAdmin: true }],
    ["school inactive", { school: { status: "SUSPENDED" } }],
  ])("still refuses on refresh when %s", async (_label, change) => {
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP), change));
    await expect(refresh(token())).rejects.toMatchObject({ status: expect.any(Number) });
  });
});

describe("a newly authenticated session works after rotation", () => {
  it("sign-in copies authTime and credStamp; a refresh and a protected call then succeed", async () => {
    const t = await authOptions.callbacks!.jwt!({ token: {}, user: { id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false, authTime: NOW, credStamp: STAMP + 1 },
      account: { provider: "credentials" } } as never);
    expect(t).toMatchObject({ authTime: NOW, credStamp: STAMP + 1 });
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP + 1)));
    await expect(refresh(t as Record<string, unknown>)).resolves.toMatchObject({ credStamp: STAMP + 1 });
    session.mockResolvedValue({ user: { ...token({ credStamp: STAMP + 1 }) } } as never);
    db.user.findUnique.mockResolvedValue(row(new Date(STAMP + 1)));
    await expect(requireRole("TEACHER")).resolves.toMatchObject({ id: "teacher-1" });
  });
  it("RED: requireUser's cached check is keyed by version, so a fresh login is not refused by a stale cache entry", async () => {
    session.mockResolvedValue({ user: token({ credStamp: STAMP + 1 }) } as never);
    db.user.findUnique.mockResolvedValue(row(new Date(STAMP + 1)));
    await requireUser();
    expect(vi.mocked(withRedisCache).mock.calls[0][0]).toContain(String(STAMP + 1));
  });
  it("requireRole still refuses the wrong role with 403", async () => {
    session.mockResolvedValue({ user: token() } as never);
    db.user.findUnique.mockResolvedValue(row(new Date(STAMP)));
    await expect(requireRole("ADMIN")).rejects.toMatchObject({ status: 403 });
  });
});

describe("unknown or invalid revocation state fails safely", () => {
  it.each([
    ["no credStamp (a token issued before R1)", token({ credStamp: undefined })],
    ["a non-numeric credStamp", token({ credStamp: "x" })],
    ["no authTime", token({ authTime: undefined })],
    ["a future authTime beyond the tolerance", token({ authTime: NOW + HOUR })],
    ["no account id", token({ id: undefined })],
  ])("RED: refresh refuses %s", async (_label, t) => {
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP)));
    await expect(refresh(t as Record<string, unknown>)).rejects.toMatchObject({ status: 401 });
  });
  it("refuses an account that no longer exists or is disabled (the read returns nothing)", async () => {
    db.user.findFirst.mockResolvedValue(null);
    await expect(refresh(token())).rejects.toMatchObject({ status: 401 });
  });
  it("refuses on a database failure (no fail-open)", async () => {
    db.user.findFirst.mockRejectedValue(new Error("db down"));
    await expect(refresh(token())).rejects.toBeDefined();
  });
});

describe("absolute session lifetime (founder: 30 days ordinary, 8 hours privileged)", () => {
  it("privileged sessions end after 8 hours; ordinary ones after 30 days", async () => {
    expect(PRIVILEGED_SESSION_MAX_AGE_MS).toBe(8 * HOUR);
    expect(ORDINARY_SESSION_MAX_AGE_MS).toBe(30 * 24 * HOUR);
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP), { role: "ADMIN" }));
    await expect(refresh(token({ role: "ADMIN", authTime: NOW - 8 * HOUR - 1 }))).rejects.toMatchObject({ status: 401 });
    await expect(refresh(token({ role: "ADMIN", authTime: NOW - 7 * HOUR }))).resolves.toBeDefined();
    db.user.findFirst.mockResolvedValue(row(new Date(STAMP)));
    await expect(refresh(token({ authTime: NOW - ORDINARY_SESSION_MAX_AGE_MS - 1 }))).rejects.toMatchObject({ status: 401 });
    await expect(refresh(token({ authTime: NOW - ORDINARY_SESSION_MAX_AGE_MS + HOUR }))).resolves.toBeDefined();
  });
});
