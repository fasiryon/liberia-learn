/**
 * Session revocation, application credential writers and the audited per-account "sign out everywhere"
 * (CoS dispatch items 5-6; Atlas REVISE R1 on 1589800a: SR-02/04/05, atomic reset redemption, accurate declarations).
 * Every writer that changes an EXISTING account's credential, disables it, or changes its identity advances the
 * credential version by compare-and-set inside an interactive transaction. Seeds are T2's and not covered here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireRole: vi.fn(), requireMoePlatformAdmin: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: auth.requireRole }));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: auth.requireMoePlatformAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => true), logAuditRequired: vi.fn(async () => undefined) }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "new-hash"), compare: vi.fn(async () => true) } }));
vi.mock("@/lib/serverFlags", () => ({ isAccountRecoveryEnabled: () => true }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0 })), getRateLimitHeaders: () => ({}),
  RATE_LIMIT_POLICIES: { AUTH: { windowMs: 60_000, limit: 10 } }, rateLimitExceededResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/db", () => {
  const user = { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(async (a: unknown) => a), updateMany: vi.fn(async () => ({ count: 1 })) };
  const prisma: Record<string, unknown> = {
    user,
    student: { findFirst: vi.fn(async () => ({ id: "s-1", placementTests: [] })) },
    teacherProfile: { update: vi.fn(async (a: unknown) => a) },
    passwordResetToken: { findFirst: vi.fn(), update: vi.fn(async (a: unknown) => a), updateMany: vi.fn(async () => ({ count: 1 })) },
    session: { deleteMany: vi.fn(async (a: unknown) => a) },
  };
  prisma.$transaction = vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])));
  return { prisma };
});

import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";
import { DISABLED_CREDENTIAL } from "@/lib/auth/sessionRevocation";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { user: Record<string, Fn>; passwordResetToken: Record<string, Fn>; teacherProfile: Record<string, Fn>; $transaction: Fn };
const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const ORIGIN = "http://local.test";
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/x`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
/** The compare-and-set version advance for one account whose stored version was null. */
const stampFor = (userId: string) => ({ where: { id: userId, passwordChangedAt: null }, data: { passwordChangedAt: new Date(NOW) } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  delete process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED;
  db.user.findUnique.mockResolvedValue({ id: "target-1", schoolId: null, passwordChangedAt: null });
  db.user.updateMany.mockResolvedValue({ count: 1 });
  db.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
});

describe("self-service credential changes revoke every earlier session", () => {
  it("a student PIN change advances the version inside a transaction and asks the client to sign in again", async () => {
    auth.requireRole.mockResolvedValue({ id: "stu-1", role: "STUDENT", schoolId: "school-1" });
    const { POST } = await import("@/app/api/student/change-pin/route");
    const res = await POST(json({ pin: "4821", confirmPin: "4821" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("stu-1"));
    expect(await res.json()).toMatchObject({ reauthenticate: true });
  });
  it("RED: a concurrent change that lost the compare-and-set returns 409, not a silent success", async () => {
    auth.requireRole.mockResolvedValue({ id: "stu-1", role: "STUDENT", schoolId: "school-1" });
    db.user.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import("@/app/api/student/change-pin/route");
    expect((await POST(json({ pin: "4821", confirmPin: "4821" }))).status).toBe(409);
  });
});

describe("admin credential actions on another account", () => {
  const teacher = { id: "t-1", email: "t@x.lr", loginId: "T1", guardianPhoneE164: null, TeacherProfile: { fullName: "T", phone: null, permissions: {} } };
  const patch = async (action: string) => {
    auth.requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    db.user.findFirst.mockResolvedValue(teacher);
    const { PATCH } = await import("@/app/api/admin/teachers/route");
    return PATCH(new Request(`${ORIGIN}/x`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "t-1", action }) }));
  };
  it("resetting a teacher's password advances the teacher's version", async () => {
    expect((await patch("resendInvite")).status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("t-1"));
  });
  it("RED: deactivation is ONE transaction: disabled marker, version advance, profile inactive and the required audit", async () => {
    expect((await patch("deactivate")).status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(typeof db.$transaction.mock.calls[0][0]).toBe("function");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { hashedPwd: DISABLED_CREDENTIAL } });
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("t-1"));
    expect(db.teacherProfile.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "t-1" } }));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1", resourceId: "t-1", action: "auth.account.disabled", schoolId: "school-1" }), expect.anything());
  });
  it("the teacher lookup stays scoped to the admin's own school (cross-school boundary unchanged)", async () => {
    await patch("deactivate");
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t-1", schoolId: "school-1", role: "TEACHER" } }));
  });
});

describe("reset redemption is atomic and single-use", () => {
  const routes = [
    ["token", "@/app/api/auth/reset-password/route", { token: "t".repeat(64), password: "a-long-new-password-1" }],
    ["code", "@/app/api/auth/reset-with-code/route", { adminCode: "123456", password: "a-long-new-password-1" }],
  ] as const;
  const record = { id: "prt-1", userId: "u-1", usedAt: null, expiresAt: new Date(NOW + 60_000), adminCode: "123456", User: { schoolId: "school-1" } };
  it.each(routes)("%s reset: claims the record conditionally, then changes the password and advances the version", async (_k, path, body) => {
    db.passwordResetToken.findFirst.mockResolvedValue(record);
    db.user.findFirst.mockResolvedValue({ id: "u-1", schoolId: "school-1" });
    const { POST } = await import(path);
    const res = await POST(json(body));
    expect(res.status).toBe(200);
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith({ where: { id: "prt-1", usedAt: null, expiresAt: { gt: new Date(NOW) } }, data: { usedAt: new Date(NOW) } });
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("u-1"));
  });
  it.each(routes)("RED (Atlas 200/200): a %s reset that loses the single-use claim is refused and changes nothing", async (_k, path, body) => {
    db.passwordResetToken.findFirst.mockResolvedValue(record);
    db.user.findFirst.mockResolvedValue({ id: "u-1", schoolId: "school-1" });
    db.passwordResetToken.updateMany.mockResolvedValue({ count: 0 }); // the other caller claimed it first
    const { POST } = await import(path);
    const res = await POST(json(body));
    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("audited per-account sign out everywhere", () => {
  const admin = { id: "pa-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null, authProvider: "auth0", mfaVerifiedAt: NOW - 60_000, assuranceExpiresAt: NOW + 3_600_000 };
  const call = async (req: Request) => (await import("@/app/api/platform/security/sessions/revoke/route")).POST(req);
  it("a platform admin with enforced MFA and a recent step-up revokes one account, audited in the same transaction", async () => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    auth.requireMoePlatformAdmin.mockResolvedValue(admin);
    const res = await call(json({ userId: "target-1", reason: "INCIDENT_CONTAINMENT" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("target-1"));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "pa-1", resourceId: "target-1", action: "auth.sessions.revoked_all",
      details: { reason: "INCIDENT_CONTAINMENT", disabled: false } }), expect.anything());
  });
  it("RED (SR-04): with MFA enforcement off, the action is unavailable even to a platform admin", async () => {
    auth.requireMoePlatformAdmin.mockResolvedValue({ ...admin, authProvider: "credentials", mfaVerifiedAt: null, assuranceExpiresAt: null });
    const res = await call(json({ userId: "target-1", reason: "INCIDENT_CONTAINMENT" }));
    expect(res.status).toBe(403);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("RED (SR-04): with enforcement on, a session without a recent step-up is refused", async () => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    auth.requireMoePlatformAdmin.mockResolvedValue({ ...admin, mfaVerifiedAt: NOW - 3 * 3_600_000 });
    expect((await call(json({ userId: "target-1", reason: "INCIDENT_CONTAINMENT" }))).status).toBe(428);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["no Origin header", { origin: "" }],
    ["a text/plain body", { "content-type": "text/plain" }],
    ["cross-site fetch metadata", { "sec-fetch-site": "cross-site" }],
  ])("RED (SR-05): refuses %s before any authority check or write", async (_label, headers) => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    auth.requireMoePlatformAdmin.mockResolvedValue(admin);
    const h: Record<string, string> = { ...headers };
    const req = new Request(`${ORIGIN}/x`, { method: "POST", headers: Object.fromEntries(Object.entries({ "content-type": "application/json", origin: ORIGIN, ...h }).filter(([, v]) => v)),
      body: JSON.stringify({ userId: "target-1", reason: "INCIDENT_CONTAINMENT" }) });
    expect((await call(req)).status).toBe(403);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("refuses without platform authority, and an unknown account or reason", async () => {
    process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED = "true";
    auth.requireMoePlatformAdmin.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    expect((await call(json({ userId: "target-1", reason: "INCIDENT_CONTAINMENT" }))).status).toBe(403);
    auth.requireMoePlatformAdmin.mockResolvedValue(admin);
    db.user.findUnique.mockResolvedValueOnce(null);
    expect((await call(json({ userId: "nobody", reason: "INCIDENT_CONTAINMENT" }))).status).toBe(404);
    expect((await call(json({ userId: "target-1", reason: "because" }))).status).toBe(400);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});
