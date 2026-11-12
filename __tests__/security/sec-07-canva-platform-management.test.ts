import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ actor: { id: "admin-A", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false },
  stepUp: true, remove: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (m.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
}, requirePrivilegedStepUp: async () => {
  if (!m.stepUp) throw Object.assign(new Error("Step-up required"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/db", () => ({ prisma: { canvaOAuthCredential: { deleteMany: m.remove } } }));
vi.mock("@/lib/canva/config", () => ({ hasCanvaMcpAuthorizationToken: m.status }));
import { DELETE } from "@/app/api/admin/canva/disconnect/route";
import { GET } from "@/app/api/admin/canva/status/route";
beforeEach(() => {
  vi.clearAllMocks(); m.actor = { id: "admin-A", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false };
  m.stepUp = true; m.remove.mockResolvedValue({ count: 1 }); m.status.mockReturnValue(true);
});
describe("SEC-07 global Canva credential management", () => {
  it.each(["school-A", "school-B"])("school ADMIN in %s cannot disconnect the platform credential", async schoolId => {
    m.actor.schoolId = schoolId; expect((await DELETE()).status).toBe(403); expect(m.remove).not.toHaveBeenCalled();
  });
  it("school ADMIN cannot read global credential status", async () => {
    expect((await GET()).status).toBe(403); expect(m.status).not.toHaveBeenCalled();
  });
  it.each(["STUDENT", "TEACHER", "GUARDIAN"])("preserves %s role denials even with a platform flag", async role => {
    m.actor.role = role; m.actor.isPlatformAdmin = true;
    expect((await DELETE()).status).toBe(403); expect((await GET()).status).toBe(403);
    expect(m.remove).not.toHaveBeenCalled(); expect(m.status).not.toHaveBeenCalled();
  });
  it("requires current step-up before disconnecting", async () => {
    m.actor.isPlatformAdmin = true; m.stepUp = false;
    expect((await DELETE()).status).toBe(403); expect(m.remove).not.toHaveBeenCalled();
  });
  it("preserves explicit platform ADMIN disconnection", async () => {
    m.actor.isPlatformAdmin = true; const response = await DELETE(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ disconnected: true });
    expect(m.remove).toHaveBeenCalledWith({ where: { provider: "canva" } });
  });
  it("preserves platform ADMIN status without returning credentials", async () => {
    m.actor.isPlatformAdmin = true; const response = await GET(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
  });
});
