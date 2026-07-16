/**
 * Security fix (2026-07-16, same night as Sprint 6.2): the /admin/agents
 * Escalations tab had NO tenant scoping - any school ADMIN could see every
 * school's EscalationQueue entries, including Sprint 6.1 safeguarding
 * escalations for children at schools they have no relationship to.
 * Confirmed live in production before this patch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockLogAudit, mockRequireAgentAdmin } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: { findMany: vi.fn(), findFirst: vi.fn() },
    escalationQueue: { findMany: vi.fn(), update: vi.fn() },
  },
  mockLogAudit: vi.fn(),
  mockRequireAgentAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

function resetAll() {
  mockRequireAgentAdmin.mockReset();
  Object.values(mockPrisma).forEach((delegate) =>
    Object.values(delegate).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  );
  mockLogAudit.mockReset();
}

describe("lib/agents/admin/escalations: listEscalations tenant scoping", () => {
  beforeEach(resetAll);

  it("with no schoolId (platform admin), returns everything unfiltered - unchanged prior behavior", async () => {
    const { listEscalations } = await import("@/lib/agents/admin/escalations");
    mockPrisma.escalationQueue.findMany.mockResolvedValue([{ id: "esc-1" }, { id: "esc-2" }]);

    const result = await listEscalations("OPEN", null);

    expect(mockPrisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.escalationQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "OPEN" } })
    );
    expect(result).toHaveLength(2);
  });

  it("with a schoolId, scopes to only escalations whose audit trail names that school", async () => {
    const { listEscalations } = await import("@/lib/agents/admin/escalations");
    mockPrisma.auditLog.findMany.mockResolvedValue([{ resourceId: "esc-1" }, { resourceId: "esc-2" }]);
    mockPrisma.escalationQueue.findMany.mockResolvedValue([{ id: "esc-1" }, { id: "esc-2" }]);

    await listEscalations("OPEN", "school-1");

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { resourceType: "EscalationQueue", schoolId: "school-1", action: "agent.escalation" } })
    );
    expect(mockPrisma.escalationQueue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "OPEN", id: { in: ["esc-1", "esc-2"] } } })
    );
  });

  it("returns an empty list without touching EscalationQueue when a school has zero scoped audit entries", async () => {
    const { listEscalations } = await import("@/lib/agents/admin/escalations");
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const result = await listEscalations("OPEN", "school-with-no-escalations");

    expect(result).toEqual([]);
    expect(mockPrisma.escalationQueue.findMany).not.toHaveBeenCalled();
  });

  it("never lets school A see school B's escalation even if school A somehow requests 'all' status", async () => {
    const { listEscalations } = await import("@/lib/agents/admin/escalations");
    // School A's audit trail only ever names school-A's escalations.
    mockPrisma.auditLog.findMany.mockResolvedValue([{ resourceId: "esc-A1" }]);
    mockPrisma.escalationQueue.findMany.mockResolvedValue([{ id: "esc-A1" }]);

    await listEscalations("all", "school-A");

    const call = mockPrisma.escalationQueue.findMany.mock.calls[0][0];
    expect(call.where.id.in).toEqual(["esc-A1"]);
    expect(call.where.id.in).not.toContain("esc-B1");
  });
});

describe("lib/agents/admin/escalations: isEscalationInSchool", () => {
  beforeEach(resetAll);

  it("returns true when the escalation's audit trail names the given school", async () => {
    const { isEscalationInSchool } = await import("@/lib/agents/admin/escalations");
    mockPrisma.auditLog.findFirst.mockResolvedValue({ id: "audit-1" });
    expect(await isEscalationInSchool("esc-1", "school-1")).toBe(true);
  });

  it("returns false when the escalation belongs to a different school", async () => {
    const { isEscalationInSchool } = await import("@/lib/agents/admin/escalations");
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    expect(await isEscalationInSchool("esc-1", "school-2")).toBe(false);
  });
});

describe("GET /api/admin/agents/escalations tenant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("passes the caller's own schoolId when the caller is a school ADMIN, not a platform admin", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockListEscalations = vi.fn(async () => []);
    vi.doMock("@/lib/agents/admin/escalations", () => ({ listEscalations: mockListEscalations }));

    const { GET } = await import("@/app/api/admin/agents/escalations/route");
    await GET(new Request("http://localhost/api/admin/agents/escalations?status=OPEN") as any);

    expect(mockListEscalations).toHaveBeenCalledWith("OPEN", "school-1");
  });

  it("passes null when the caller is a true platform admin, preserving full visibility for that role", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "super-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockListEscalations = vi.fn(async () => []);
    vi.doMock("@/lib/agents/admin/escalations", () => ({ listEscalations: mockListEscalations }));

    const { GET } = await import("@/app/api/admin/agents/escalations/route");
    await GET(new Request("http://localhost/api/admin/agents/escalations?status=OPEN") as any);

    expect(mockListEscalations).toHaveBeenCalledWith("OPEN", null);
  });
});

describe("PATCH /api/admin/agents/escalations/[id] tenant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("forbids a school ADMIN from resolving an escalation outside their own school", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockIsEscalationInSchool = vi.fn(async () => false);
    const mockResolveEscalation = vi.fn();
    vi.doMock("@/lib/agents/admin/escalations", () => ({
      isEscalationInSchool: mockIsEscalationInSchool,
      resolveEscalation: mockResolveEscalation,
      assignEscalation: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/admin/agents/escalations/[id]/route");
    const req = { json: async () => ({ action: "resolve", resolution: "done" }) } as any;
    const res = await PATCH(req, { params: Promise.resolve({ id: "esc-other-school" }) });

    expect(res.status).toBe(403);
    expect(mockResolveEscalation).not.toHaveBeenCalled();
  });

  it("allows a school ADMIN to resolve an escalation that is in scope for their own school", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockIsEscalationInSchool = vi.fn(async () => true);
    const mockResolveEscalation = vi.fn(async () => ({}));
    vi.doMock("@/lib/agents/admin/escalations", () => ({
      isEscalationInSchool: mockIsEscalationInSchool,
      resolveEscalation: mockResolveEscalation,
      assignEscalation: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/admin/agents/escalations/[id]/route");
    const req = { json: async () => ({ action: "resolve", resolution: "done" }) } as any;
    const res = await PATCH(req, { params: Promise.resolve({ id: "esc-own-school" }) });

    expect(res.status).toBe(200);
    expect(mockResolveEscalation).toHaveBeenCalledWith("esc-own-school", "done", "admin-1");
  });

  it("bypasses the school-scope check entirely for a true platform admin", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "super-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockIsEscalationInSchool = vi.fn();
    const mockResolveEscalation = vi.fn(async () => ({}));
    vi.doMock("@/lib/agents/admin/escalations", () => ({
      isEscalationInSchool: mockIsEscalationInSchool,
      resolveEscalation: mockResolveEscalation,
      assignEscalation: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/admin/agents/escalations/[id]/route");
    const req = { json: async () => ({ action: "resolve", resolution: "done" }) } as any;
    const res = await PATCH(req, { params: Promise.resolve({ id: "esc-any-school" }) });

    expect(res.status).toBe(200);
    expect(mockIsEscalationInSchool).not.toHaveBeenCalled();
    expect(mockResolveEscalation).toHaveBeenCalled();
  });

  it("forbids a school ADMIN with no schoolId at all rather than defaulting to open access", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/admin/guard", () => ({
      requireAgentAdmin: vi.fn(async () => ({ id: "admin-1", role: "ADMIN", schoolId: null, isPlatformAdmin: false })),
      agentAdminStatus: (e: unknown) => (e as { status?: number })?.status ?? 500,
    }));
    const mockResolveEscalation = vi.fn();
    vi.doMock("@/lib/agents/admin/escalations", () => ({
      isEscalationInSchool: vi.fn(),
      resolveEscalation: mockResolveEscalation,
      assignEscalation: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/admin/agents/escalations/[id]/route");
    const req = { json: async () => ({ action: "resolve", resolution: "done" }) } as any;
    const res = await PATCH(req, { params: Promise.resolve({ id: "esc-1" }) });

    expect(res.status).toBe(403);
    expect(mockResolveEscalation).not.toHaveBeenCalled();
  });
});
