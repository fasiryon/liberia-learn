import { describe, it, expect, vi, beforeEach } from "vitest";

const invGroupBy = vi.fn();
const costFindMany = vi.fn();
const invGroupByUser = vi.fn();
const getAllControls = vi.fn();
const isAgentEnabled = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentInvocation: { groupBy: (arg: { by: string[] }) => routeGroupBy(arg) },
    agentCostAccounting: { findMany: (...a: unknown[]) => costFindMany(...a) },
  },
}));
// agentInvocation.groupBy is used for both agentName counts and userId cost;
// dispatch on the `by` argument.
function routeGroupBy(arg: { by: string[] }) {
  if (arg.by.includes("userId")) return invGroupByUser(arg);
  return invGroupBy(arg);
}
vi.mock("@/lib/agents/control", () => ({ getAllControls: (...a: unknown[]) => getAllControls(...a) }));
vi.mock("@/lib/agents/flags", () => ({ isAgentEnabled: (...a: unknown[]) => isAgentEnabled(...a) }));

import { registerAgent } from "@/lib/agents/registry";
import { listAgentsWithStats, costDashboard, triggerMonitor } from "@/lib/agents/admin/stats";

registerAgent({
  name: "stats-agent",
  description: "d",
  systemPromptKey: "k",
  toolAllowlist: [],
  maxTokens: 100,
  costLimits: { perInvocationUSD: 0.01, perUserPerDayUSD: 0.1, perDayTotalUSD: 1 },
  featureFlag: "AGENT_STATS_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
});

const now = new Date("2026-07-08T12:00:00Z");

describe("listAgentsWithStats", () => {
  beforeEach(() => {
    invGroupBy.mockReset();
    costFindMany.mockReset();
    getAllControls.mockReset();
    isAgentEnabled.mockReset();
    invGroupBy.mockResolvedValue([{ agentName: "stats-agent", _count: { _all: 7 } }]);
    costFindMany.mockResolvedValue([{ agentName: "stats-agent", totalLlmCostUSD: 0.05 }]);
    getAllControls.mockResolvedValue({ "stats-agent": true });
    isAgentEnabled.mockReturnValue(false);
  });

  it("merges registry agents with invocation counts, week cost, and control state", async () => {
    const rows = await listAgentsWithStats(now);
    const a = rows.find((r) => r.name === "stats-agent")!;
    expect(a.invocationCount).toBe(7);
    expect(a.costThisWeekUSD).toBeCloseTo(0.05, 6);
    expect(a.override).toBe(true);
    expect(a.envEnabled).toBe(false);
    // override true wins over env false
    expect(a.effectiveEnabled).toBe(true);
  });
});

describe("costDashboard", () => {
  beforeEach(() => {
    costFindMany.mockReset();
    invGroupByUser.mockReset();
    costFindMany.mockResolvedValue([
      { agentName: "stats-agent", date: new Date("2026-07-08"), totalLlmCostUSD: 0.02, totalInvocations: 2 },
      { agentName: "stats-agent", date: new Date("2026-07-05"), totalLlmCostUSD: 0.03, totalInvocations: 1 },
    ]);
    invGroupByUser.mockResolvedValue([{ userId: "u1", _sum: { llmCostUSD: 0.9 } }]);
  });

  it("aggregates per-agent daily/weekly/monthly cost and top users", async () => {
    const d = await costDashboard(now);
    const a = d.perAgent.find((x) => x.agentName === "stats-agent")!;
    expect(a.monthlyUSD).toBeCloseTo(0.05, 6); // both rows in month
    expect(a.dailyUSD).toBeCloseTo(0.02, 6); // only the 2026-07-08 row
    expect(d.topUsers[0]).toMatchObject({ userId: "u1" });
    expect(d.topUsers[0].costUSD).toBeCloseTo(0.9, 6);
  });
});

describe("triggerMonitor", () => {
  beforeEach(() => {
    invGroupBy.mockReset();
    invGroupBy.mockResolvedValue([
      { agentName: "stats-agent", status: "SUCCESS", _count: { _all: 3 } },
      { agentName: "stats-agent", status: "FAILURE", _count: { _all: 1 } },
    ]);
  });

  it("computes per-agent event totals and success rate", async () => {
    const rows = await triggerMonitor(now);
    const a = rows.find((r) => r.agentName === "stats-agent")!;
    expect(a.total).toBe(4);
    expect(a.success).toBe(3);
    expect(a.successRate).toBeCloseTo(0.75, 2);
    // scoped to EVENT-triggered invocations
    expect(invGroupBy.mock.calls[0][0].where.triggeredBy).toBe("EVENT");
  });
});
