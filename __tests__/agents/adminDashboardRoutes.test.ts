import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const listAgentsWithStats = vi.fn();
const costDashboard = vi.fn();
const triggerMonitor = vi.fn();
const setAgentControl = vi.fn();
const listEscalations = vi.fn();
const assignEscalation = vi.fn();
const resolveEscalation = vi.fn();
const isEscalationInSchool = vi.fn();
const goalFindMany = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
  requirePlatformAdmin: async (...a: unknown[]) => {
    const user = await requireUser(...a);
    if (!user.isPlatformAdmin) throw Object.assign(new Error("Forbidden - platform admin required"), { status: 403 });
    return user;
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { agentGoal: { findMany: (...a: unknown[]) => goalFindMany(...a) } } }));
vi.mock("@/lib/agents/admin/stats", () => ({
  listAgentsWithStats: (...a: unknown[]) => listAgentsWithStats(...a),
  costDashboard: (...a: unknown[]) => costDashboard(...a),
  triggerMonitor: (...a: unknown[]) => triggerMonitor(...a),
}));
vi.mock("@/lib/agents/control", () => ({ setAgentControl: (...a: unknown[]) => setAgentControl(...a) }));
vi.mock("@/lib/agents/admin/escalations", () => ({
  listEscalations: (...a: unknown[]) => listEscalations(...a),
  assignEscalation: (...a: unknown[]) => assignEscalation(...a),
  resolveEscalation: (...a: unknown[]) => resolveEscalation(...a),
  isEscalationInSchool: (...a: unknown[]) => isEscalationInSchool(...a),
}));
vi.mock("@/lib/agents/bootstrap", () => ({}));

import { GET as agentsGET } from "@/app/api/admin/agents/route";
import { POST as togglePOST } from "@/app/api/admin/agents/[name]/toggle/route";
import { GET as costGET } from "@/app/api/admin/agents/cost/route";
import { GET as goalsGET } from "@/app/api/admin/agents/goals/route";
import { GET as escGET } from "@/app/api/admin/agents/escalations/route";
import { PATCH as escPATCH } from "@/app/api/admin/agents/escalations/[id]/route";

const admin = { id: "a1", role: "ADMIN", schoolId: "s1", isPlatformAdmin: false };
const platformAdmin = { id: "pa1", role: "ADMIN", schoolId: null, isPlatformAdmin: true };
const student = { id: "s2", role: "STUDENT", schoolId: "s1", isPlatformAdmin: false };

function jreq(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  }) as never;
}

describe("agent dashboard routes", () => {
  beforeEach(() => {
    [requireUser, listAgentsWithStats, costDashboard, triggerMonitor, setAgentControl,
     listEscalations, assignEscalation, resolveEscalation, isEscalationInSchool, goalFindMany].forEach((m) => m.mockReset());
    requireUser.mockResolvedValue(admin);
    listAgentsWithStats.mockResolvedValue([{ name: "echo", invocationCount: 3 }]);
    costDashboard.mockResolvedValue({ perAgent: [], trend: [], topUsers: [] });
    listEscalations.mockResolvedValue([{ id: "e1" }]);
    goalFindMany.mockResolvedValue([{ id: "g1", status: "OPEN" }]);
    setAgentControl.mockResolvedValue(undefined);
    assignEscalation.mockResolvedValue({ id: "e1" });
    resolveEscalation.mockResolvedValue({ id: "e1" });
    // Sprint 6.2-night tenant-scoping fix: this admin's schoolId (s1) is in
    // scope for the escalation under test by default in these route tests.
    isEscalationInSchool.mockResolvedValue(true);
  });

  it("GET /api/admin/agents denies non-admins", async () => {
    requireUser.mockResolvedValue(student);
    const res = await agentsGET();
    expect(res.status).toBe(403);
    expect(listAgentsWithStats).not.toHaveBeenCalled();
  });

  it("GET /api/admin/agents denies a school ADMIN (platform-wide data, no per-school scoping exists)", async () => {
    requireUser.mockResolvedValue(admin);
    const res = await agentsGET();
    expect(res.status).toBe(403);
    expect(listAgentsWithStats).not.toHaveBeenCalled();
  });

  it("GET /api/admin/agents returns stats for a platform admin", async () => {
    requireUser.mockResolvedValue(platformAdmin);
    const res = await agentsGET();
    expect(res.status).toBe(200);
    expect((await res.json()).agents).toHaveLength(1);
  });

  it("POST toggle denies a school ADMIN (platform-wide kill switch)", async () => {
    requireUser.mockResolvedValue(admin);
    const res = await togglePOST(jreq("http://x/api/admin/agents/echo/toggle", { enabled: false }), {
      params: Promise.resolve({ name: "echo" }),
    });
    expect(res.status).toBe(403);
    expect(setAgentControl).not.toHaveBeenCalled();
  });

  it("POST toggle sets the agent control override for a platform admin", async () => {
    requireUser.mockResolvedValue(platformAdmin);
    const res = await togglePOST(jreq("http://x/api/admin/agents/echo/toggle", { enabled: false }), {
      params: Promise.resolve({ name: "echo" }),
    });
    expect(res.status).toBe(200);
    expect(setAgentControl).toHaveBeenCalledWith("echo", false, "pa1");
  });

  it("GET cost / goals deny a school ADMIN (platform-wide data, no per-school scoping exists)", async () => {
    requireUser.mockResolvedValue(admin);
    expect((await costGET()).status).toBe(403);
    expect((await goalsGET(jreq("http://x/api/admin/agents/goals"))).status).toBe(403);
  });

  it("GET cost / goals / escalations return their payloads", async () => {
    requireUser.mockResolvedValue(platformAdmin);
    expect((await costGET()).status).toBe(200);
    const goals = await goalsGET(jreq("http://x/api/admin/agents/goals"));
    expect((await goals.json()).goals).toHaveLength(1);
    const esc = await escGET(jreq("http://x/api/admin/agents/escalations"));
    expect((await esc.json()).escalations).toHaveLength(1);
  });

  it("PATCH escalation resolves when action=resolve", async () => {
    const res = await escPATCH(
      jreq("http://x/api/admin/agents/escalations/e1", { action: "resolve", resolution: "done" }),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
    expect(resolveEscalation).toHaveBeenCalledWith("e1", "done", "a1");
  });

  it("PATCH escalation assigns when action=assign", async () => {
    const res = await escPATCH(
      jreq("http://x/api/admin/agents/escalations/e1", { action: "assign", assignedTo: "a2" }),
      { params: Promise.resolve({ id: "e1" }) }
    );
    expect(res.status).toBe(200);
    expect(assignEscalation).toHaveBeenCalledWith("e1", "a2", "a1");
  });
});
