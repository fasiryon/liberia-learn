import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), audits: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/db", () => ({ prisma: { escalationQueue: { findMany: mocks.list }, auditLog: { findMany: mocks.audits } } }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
import { GET } from "@/app/api/admin/agents/escalations/route";
beforeEach(() => {
  vi.clearAllMocks(); mocks.list.mockResolvedValue([{ id: "synthetic-escalation-B" }]);
  mocks.audits.mockResolvedValue([{ resourceId: "synthetic-escalation-A" }]);
});
describe("AT-ADJ-01 school-less administrator escalation boundary", () => {
  it.each([null, undefined, "", "   "])("missing school %s cannot become global scope", async schoolId => {
    mocks.user.mockResolvedValue({ id: "synthetic-admin-A", role: "ADMIN", schoolId, isPlatformAdmin: false });
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/escalations"));
    expect(response.status).toBe(403); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.audits).not.toHaveBeenCalled();
  });
  it("school administrator remains audit-scoped", async () => {
    mocks.user.mockResolvedValue({ id: "synthetic-admin-A", role: "ADMIN", schoolId: "synthetic-school-A", isPlatformAdmin: false });
    mocks.list.mockResolvedValue([{ id: "synthetic-escalation-A" }]);
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/escalations"));
    expect(response.status).toBe(200); expect((await response.json()).escalations).toEqual([{ id: "synthetic-escalation-A" }]);
    expect(mocks.audits).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: "synthetic-school-A" }) }));
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["synthetic-escalation-A"] } }) }));
  });
  it("explicit platform administrator retains platform queue access", async () => {
    mocks.user.mockResolvedValue({ id: "synthetic-platform-admin", role: "ADMIN", schoolId: null, isPlatformAdmin: true });
    const response = await GET(new NextRequest("http://atlas.invalid/api/admin/agents/escalations"));
    expect(response.status).toBe(200); expect(mocks.audits).not.toHaveBeenCalled(); expect(mocks.list).toHaveBeenCalledOnce();
  });
});
