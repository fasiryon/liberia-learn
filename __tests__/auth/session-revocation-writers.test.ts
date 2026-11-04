/**
 * Session revocation, application credential writers (CoS dispatch item 5) and the audited per-account
 * "sign out everywhere" (item 6). Every writer that changes an EXISTING account's credential, or disables it, must
 * advance passwordChangedAt monotonically so that every session issued before it is refused.
 * Seeds (prisma/seed.ts, prisma/seeds/cha-demo.ts) are T2's and are intentionally not covered here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requirePrivilegedStepUp: vi.fn(async (u: unknown) => u),
  requireMoePlatformAdmin: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: auth.requireRole, requirePrivilegedStepUp: auth.requirePrivilegedStepUp }));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: auth.requireMoePlatformAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => true), logAuditRequired: vi.fn(async () => undefined) }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "new-hash"), compare: vi.fn(async () => true) } }));
vi.mock("@/lib/serverFlags", () => ({ isAccountRecoveryEnabled: () => true }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0 })), getRateLimitHeaders: () => ({}),
  RATE_LIMIT_POLICIES: { AUTH: { windowMs: 60_000, limit: 10 } }, rateLimitExceededResponse: () => new Response(null, { status: 429 }) }));
vi.mock("@/lib/db", () => {
  const user = { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(async (a: unknown) => a), updateMany: vi.fn(async (a: unknown) => a) };
  const prisma: Record<string, unknown> = {
    user,
    student: { findFirst: vi.fn(async () => ({ id: "s-1", placementTests: [] })) },
    teacherProfile: { update: vi.fn(async (a: unknown) => a) },
    passwordResetToken: { findFirst: vi.fn(), update: vi.fn(async (a: unknown) => a) },
    session: { deleteMany: vi.fn(async (a: unknown) => a) },
  };
  prisma.$transaction = vi.fn(async (arg: unknown) => (typeof arg === "function" ? (arg as (t: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])));
  return { prisma };
});

import { prisma } from "@/lib/db";
import { logAuditRequired } from "@/lib/audit";

const db = prisma as unknown as { user: Record<string, ReturnType<typeof vi.fn>>; passwordResetToken: Record<string, ReturnType<typeof vi.fn>> };
const NOW = Date.parse("2026-11-04T12:00:00.000Z");
const json = (body: unknown) => new Request("http://local.test/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
/** The monotonic revocation stamp for one account. */
const stampFor = (userId: string) => expect.objectContaining({
  where: { id: userId, OR: [{ passwordChangedAt: null }, { passwordChangedAt: { lt: new Date(NOW) } }] },
  data: { passwordChangedAt: new Date(NOW) },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

describe("self-service credential changes revoke every earlier session", () => {
  it("RED: a student PIN change advances passwordChangedAt (it set nothing before)", async () => {
    auth.requireRole.mockResolvedValue({ id: "stu-1", role: "STUDENT", schoolId: "school-1" });
    const { POST } = await import("@/app/api/student/change-pin/route");
    const res = await POST(json({ pin: "4821", confirmPin: "4821" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("stu-1"));
    const body = await res.json();
    expect(body).toMatchObject({ reauthenticate: true });
  });
});

describe("admin credential actions on another account", () => {
  const teacher = { id: "t-1", email: "t@x.lr", loginId: "T1", guardianPhoneE164: null, TeacherProfile: { fullName: "T", phone: null, permissions: {} } };
  const patch = async (action: string) => {
    auth.requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1" });
    db.user.findFirst.mockResolvedValue(teacher);
    const { PATCH } = await import("@/app/api/admin/teachers/route");
    return PATCH(new Request("http://local.test/x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "t-1", action }) }));
  };
  it("RED: resetting a teacher's password revokes the teacher's sessions", async () => {
    const res = await patch("resendInvite");
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("t-1"));
  });
  it("RED: deactivating a teacher disables the credential and revokes its sessions, with a required audit", async () => {
    const res = await patch("deactivate");
    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { hashedPwd: "" } });
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("t-1"));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1", resourceId: "t-1", action: "auth.account.disabled", schoolId: "school-1" }), expect.anything());
  });
  it("the teacher lookup stays scoped to the admin's own school (cross-school boundary unchanged)", async () => {
    await patch("deactivate");
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t-1", schoolId: "school-1", role: "TEACHER" } }));
  });
});

describe("token password reset", () => {
  it("RED: the reset uses the monotonic stamp, so a concurrent earlier reset cannot move it back", async () => {
    db.passwordResetToken.findFirst.mockResolvedValue({ id: "prt-1", userId: "u-1", usedAt: null, expiresAt: new Date(NOW + 60_000), User: { schoolId: "school-1" } });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const res = await POST(json({ token: "t".repeat(64), password: "a-long-new-password-1" }));
    expect(res.status).toBe(200);
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("u-1"));
  });
});

describe("audited per-account sign out everywhere", () => {
  it("RED: a platform admin with step-up revokes one account's sessions, audited in the same transaction", async () => {
    auth.requireMoePlatformAdmin.mockResolvedValue({ id: "pa-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null });
    db.user.findUnique.mockResolvedValue({ id: "moe-1", schoolId: null });
    const { POST } = await import("@/app/api/platform/security/sessions/revoke/route");
    const res = await POST(json({ userId: "moe-1", reason: "INCIDENT_CONTAINMENT" }));
    expect(res.status).toBe(200);
    expect(auth.requirePrivilegedStepUp).toHaveBeenCalled();
    expect(db.user.updateMany).toHaveBeenCalledWith(stampFor("moe-1"));
    expect(logAuditRequired).toHaveBeenCalledWith(expect.objectContaining({ userId: "pa-1", resourceId: "moe-1", action: "auth.sessions.revoked_all",
      details: { reason: "INCIDENT_CONTAINMENT", disabled: false } }), expect.anything());
  });
  it("RED: it refuses without platform authority and never writes", async () => {
    auth.requireMoePlatformAdmin.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { POST } = await import("@/app/api/platform/security/sessions/revoke/route");
    const res = await POST(json({ userId: "moe-1", reason: "INCIDENT_CONTAINMENT" }));
    expect(res.status).toBe(403);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it("RED: it refuses an unknown account or reason", async () => {
    auth.requireMoePlatformAdmin.mockResolvedValue({ id: "pa-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null });
    db.user.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/platform/security/sessions/revoke/route");
    expect((await POST(json({ userId: "nobody", reason: "INCIDENT_CONTAINMENT" }))).status).toBe(404);
    expect((await POST(json({ userId: "moe-1", reason: "because" }))).status).toBe(400);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
});
