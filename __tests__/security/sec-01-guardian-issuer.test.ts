import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ guardian: {} as Record<string, unknown>, update: vi.fn(), identity: vi.fn(),
  createInvite: vi.fn(), audit: vi.fn(), email: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => ({ id: "admin-1", role: "ADMIN", schoolId: "school-A" }) }));
vi.mock("@/lib/serverFlags", () => ({ isGuardianLinkingEnabled: () => true }));
vi.mock("@/lib/preview/identityFreeze", () => ({ previewIdentityFrozen: () => null }));
vi.mock("@/lib/preview/safeError", () => ({ previewSafeErrorResponse: () => null }));
vi.mock("@/lib/phone", () => ({ normalizeToE164: (phone: string) => phone }));
vi.mock("@/lib/tokens", () => ({ generateTokenPair: () => ({ token: "synthetic-token", tokenHash: "synthetic-hash" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit }));
vi.mock("@/lib/email", () => ({ sendGuardianInvite: m.email }));
vi.mock("@/lib/auth/sessionRevocation", () => ({ updateUserIdentity: m.identity }));
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findUnique: async () => ({ id: "student-1", user: { schoolId: "school-A", name: "Synthetic child" } }) },
  user: { findUnique: async () => m.guardian, update: m.update },
  inviteToken: { create: m.createInvite }, school: { findUnique: async () => ({ name: "Synthetic school" }) },
} }));
import { POST } from "@/app/api/admin/guardian-link/route";
const issue = () => POST(new Request("http://localhost/api/admin/guardian-link", { method: "POST",
  headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: "student-1",
    guardianEmail: "guardian@synthetic.invalid", guardianPhone: "+231770000111" }) }));
beforeEach(() => {
  vi.clearAllMocks();
  m.guardian = { id: "guardian-1", role: "GUARDIAN", schoolId: "school-A", isPlatformAdmin: false };
  m.createInvite.mockResolvedValue({ id: "invite-1" }); m.email.mockResolvedValue({ ok: true });
  m.identity.mockImplementation(async () => m.guardian);
});
describe("SEC-01 guardian-link issuer", () => {
  it.each(["STUDENT", "TEACHER", "ADMIN"])("does not issue a guardian invite or alter a %s profile", async (role) => {
    m.guardian.role = role;
    expect((await issue()).status).toBe(403);
    expect(m.update).not.toHaveBeenCalled(); expect(m.identity).not.toHaveBeenCalled();
    expect(m.createInvite).not.toHaveBeenCalled(); expect(m.email).not.toHaveBeenCalled();
  });
  it("does not issue a guardian invite for a platform account", async () => {
    m.guardian.isPlatformAdmin = true;
    expect((await issue()).status).toBe(403);
    expect(m.createInvite).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it("keeps existing cross-school refusal", async () => {
    m.guardian.schoolId = "school-B";
    expect((await issue()).status).toBe(403); expect(m.createInvite).not.toHaveBeenCalled();
  });
  it("preserves same-school guardian issuance and audit", async () => {
    expect((await issue()).status).toBe(200);
    expect(m.createInvite).toHaveBeenCalledTimes(1); expect(m.email).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.guardian-link.created", schoolId: "school-A" }));
  });
});
