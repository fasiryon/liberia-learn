import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  beforeTransaction: () => {},
  update: vi.fn(), updateMany: vi.fn(), link: vi.fn(), consent: vi.fn(), claim: vi.fn(),
  stamp: vi.fn(), welcome: vi.fn(), hash: vi.fn(), student: vi.fn(),
}));
vi.mock("bcryptjs", () => ({ default: { hash: m.hash } }));
vi.mock("@/lib/preview/identityFreeze", () => ({ previewIdentityFrozen: () => null }));
vi.mock("@/lib/auth/sessionRevocation", () => ({ advanceSecurityStamp: m.stamp }));
vi.mock("@/lib/email", () => ({ sendGuardianWelcome: m.welcome }));
vi.mock("@/lib/inviteTokens", () => ({ findInviteByToken: async () => ({
  id: "invite-1", tokenType: "GUARDIAN_LINK", schoolId: "school-A", studentId: "student-1",
  email: "guardian@synthetic.invalid", usedAt: null, expiresAt: new Date(Date.now() + 60_000),
}) }));
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findUnique: m.student }, school: { findUnique: async () => ({ name: "Synthetic school" }) },
  user: { findUnique: async () => ({ ...m.user }) },
  $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
    m.beforeTransaction();
    return work({ user: { update: m.update, updateMany: m.updateMany },
      studentGuardian: { upsert: m.link }, guardianConsent: { upsert: m.consent },
      inviteToken: { updateMany: m.claim } });
  },
} }));
import { POST } from "@/app/api/guardian/register/route";

const register = () => POST(new Request("http://localhost/api/guardian/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "synthetic-invite", fullName: "Invited guardian", pin: "6382", confirmPin: "6382" }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.user = { id: "guardian-1", email: "guardian@synthetic.invalid", role: "GUARDIAN", schoolId: "school-A",
    isPlatformAdmin: false, guardianPhoneE164: "+231770000111", hashedPwd: "original-hash" };
  m.beforeTransaction = () => {};
  m.hash.mockResolvedValue("synthetic-new-hash");
  m.student.mockResolvedValue({ id: "student-1", user: { schoolId: "school-A" } });
  m.update.mockImplementation(async ({ data }) => { Object.assign(m.user, data); return { ...m.user }; });
  // Boundary adapter for conditional-write behavior only. Native PostgreSQL proves locking/rollback separately.
  m.updateMany.mockImplementation(async ({ where, data }) => {
    if (!Object.entries(where).every(([key, value]) => m.user[key] === value)) return { count: 0 };
    Object.assign(m.user, data); return { count: 1 };
  });
  m.claim.mockResolvedValue({ count: 1 });
});

const expectRefused = async () => {
  const before = { ...m.user };
  const response = await register();
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe("This link has expired. Please contact your child's school.");
  expect(m.user).toEqual(before);
  expect(m.link).not.toHaveBeenCalled(); expect(m.consent).not.toHaveBeenCalled();
  expect(m.stamp).not.toHaveBeenCalled(); expect(m.claim).not.toHaveBeenCalled();
  expect(m.welcome).not.toHaveBeenCalled();
};

describe("SEC-01 guardian invite credential authority", () => {
  it.each(["STUDENT", "TEACHER", "ADMIN", "MOE_OFFICIAL", "DISTRICT_OFFICIAL"])(
    "does not change an existing %s account even when it has a guardian phone", async (role) => {
      m.user.role = role; await expectRefused();
    });
  it("does not change a platform administrator with GUARDIAN role", async () => {
    m.user.isPlatformAdmin = true; await expectRefused();
  });
  it.each(["school-B", null])("does not rebind a guardian from school %s", async (schoolId) => {
    m.user.schoolId = schoolId; await expectRefused();
  });
  it.each(["role", "schoolId", "isPlatformAdmin"])("rechecks %s in the claim transaction", async (field) => {
    m.beforeTransaction = () => { m.user[field] = field === "role" ? "TEACHER" : field === "schoolId" ? "school-B" : true; };
    const response = await register();
    expect(response.status).toBe(400);
    expect(m.user.hashedPwd).toBe("original-hash");
    expect(m.link).not.toHaveBeenCalled(); expect(m.stamp).not.toHaveBeenCalled();
    expect(m.claim).not.toHaveBeenCalled(); expect(m.welcome).not.toHaveBeenCalled();
  });
  it("updates a same-school guardian PIN, preserves identity and advances session revocation", async () => {
    const response = await register();
    expect(response.status).toBe(200);
    expect(m.user).toMatchObject({ role: "GUARDIAN", schoolId: "school-A", isPlatformAdmin: false,
      email: "guardian@synthetic.invalid", hashedPwd: "synthetic-new-hash" });
    expect(m.stamp).toHaveBeenCalledWith(expect.anything(), "guardian-1");
    expect(m.link).toHaveBeenCalledTimes(1); expect(m.consent).toHaveBeenCalledTimes(1);
    expect(m.claim).toHaveBeenCalledTimes(1); expect(m.welcome).toHaveBeenCalledTimes(1);
  });
  it("refuses a student from a different school", async () => {
    m.student.mockResolvedValue({ id: "student-1", user: { schoolId: "school-B" } });
    await expectRefused();
  });
});
