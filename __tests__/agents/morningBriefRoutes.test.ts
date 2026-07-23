import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveAgentEnabled = vi.hoisted(() => vi.fn());
const mockRunMorningBriefSweep = vi.hoisted(() => vi.fn());
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockRunAgent = vi.hoisted(() => vi.fn());
const mockBriefFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/bootstrap", () => ({}));
vi.mock("@/lib/agents/control", () => ({ resolveAgentEnabled: mockResolveAgentEnabled }));
vi.mock("@/lib/agents/morningBrief/sweep", () => ({ runMorningBriefSweep: mockRunMorningBriefSweep }));
vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser, requireRole: mockRequireRole }));
vi.mock("@/lib/permissions", () => ({
  assertPermission: mockAssertPermission,
  PERMISSIONS: { AGENT_PLATFORM_VIEW: "AGENT_PLATFORM_VIEW" },
}));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));
vi.mock("@/lib/db", () => ({ prisma: { teacherMorningBrief: { findUnique: mockBriefFindUnique } } }));

describe("POST /api/cron/morning-brief-sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("401s without the correct CRON_SECRET bearer token", async () => {
    const { POST } = await import("@/app/api/cron/morning-brief-sweep/route");
    const req = new Request("http://localhost/api/cron/morning-brief-sweep", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("skips the sweep when the agent is feature-disabled", async () => {
    mockResolveAgentEnabled.mockResolvedValue(false);
    const { POST } = await import("@/app/api/cron/morning-brief-sweep/route");
    const req = new Request("http://localhost/api/cron/morning-brief-sweep", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(mockRunMorningBriefSweep).not.toHaveBeenCalled();
  });

  it("runs the sweep when enabled and authorized", async () => {
    mockResolveAgentEnabled.mockResolvedValue(true);
    mockRunMorningBriefSweep.mockResolvedValue({ ranAt: "now", briefDate: "2026-07-22", items: [] });
    const { POST } = await import("@/app/api/cron/morning-brief-sweep/route");
    const req = new Request("http://localhost/api/cron/morning-brief-sweep", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockRunMorningBriefSweep).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/admin/agents/morning-brief/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeReq(body: unknown) {
    return new Request("http://localhost/api/admin/agents/morning-brief/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("requires platform admin", async () => {
    mockRequireUser.mockResolvedValue({ id: "u1", isPlatformAdmin: false });
    const { POST } = await import("@/app/api/admin/agents/morning-brief/run/route");
    const res = await POST(makeReq({ teacherUserId: "teacher-1" }) as any);
    expect(res.status).toBe(403);
  });

  it("requires a teacherUserId in the body", async () => {
    mockRequireUser.mockResolvedValue({ id: "u1", isPlatformAdmin: true });
    const { POST } = await import("@/app/api/admin/agents/morning-brief/run/route");
    const res = await POST(makeReq({}) as any);
    expect(res.status).toBe(400);
  });

  it("invokes the morning-brief agent for the given teacher", async () => {
    mockRequireUser.mockResolvedValue({ id: "admin-1", isPlatformAdmin: true, schoolId: null });
    mockRunAgent.mockResolvedValue({ invocationId: "inv-1", status: "SUCCESS" });
    const { POST } = await import("@/app/api/admin/agents/morning-brief/run/route");
    const res = await POST(makeReq({ teacherUserId: "teacher-1" }) as any);
    expect(res.status).toBe(200);
    expect(mockRunAgent).toHaveBeenCalledWith(
      "morning-brief",
      expect.stringContaining("teacher-1"),
      expect.objectContaining({ userId: "admin-1", triggeredBy: "USER" })
    );
  });
});

describe("GET /api/teacher/brief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires TEACHER or ADMIN role", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { GET } = await import("@/app/api/teacher/brief/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns null when no brief exists for today", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mockBriefFindUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/teacher/brief/route");
    const res = await GET();
    const body = await res.json();
    expect(body.brief).toBeNull();
  });

  it("returns the teacher's own brief only, never another teacher's", async () => {
    mockRequireRole.mockResolvedValue({ id: "teacher-1", role: "TEACHER" });
    mockBriefFindUnique.mockResolvedValue({ briefText: "All clear today.", createdAt: new Date("2026-07-22T05:00:00.000Z") });
    const { GET } = await import("@/app/api/teacher/brief/route");
    const res = await GET();
    const body = await res.json();
    expect(body.brief.briefText).toBe("All clear today.");
    expect(mockBriefFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teacherUserId_briefDate: expect.objectContaining({ teacherUserId: "teacher-1" }),
        }),
      })
    );
  });
});
