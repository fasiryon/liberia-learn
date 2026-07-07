import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const aggregate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentCostAccounting: { findUnique: (...a: unknown[]) => findUnique(...a) },
    agentInvocation: { aggregate: (...a: unknown[]) => aggregate(...a) },
  },
}));

import { checkCostCaps } from "@/lib/agents/costEnforcement";

const limits = { perInvocationUSD: 0.01, perUserPerDayUSD: 0.1, perDayTotalUSD: 1 };
const at = new Date("2026-07-07T10:00:00.000Z");

describe("checkCostCaps", () => {
  beforeEach(() => {
    findUnique.mockReset();
    aggregate.mockReset();
    findUnique.mockResolvedValue({ totalLlmCostUSD: 0.2 });
    aggregate.mockResolvedValue({ _sum: { llmCostUSD: 0.02 } });
  });

  it("allows when both user and day totals are under caps", async () => {
    const r = await checkCostCaps({ agentName: "echo", userId: "u1", costLimits: limits, at });
    expect(r.allowed).toBe(true);
  });

  it("blocks when the per-day total cap is reached", async () => {
    findUnique.mockResolvedValue({ totalLlmCostUSD: 1.0 });
    const r = await checkCostCaps({ agentName: "echo", userId: "u1", costLimits: limits, at });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("day_total_cap");
  });

  it("blocks when the per-user daily cap is reached", async () => {
    aggregate.mockResolvedValue({ _sum: { llmCostUSD: 0.1 } });
    const r = await checkCostCaps({ agentName: "echo", userId: "u1", costLimits: limits, at });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("user_daily_cap");
  });

  it("skips the per-user check for system-triggered runs (no userId)", async () => {
    aggregate.mockResolvedValue({ _sum: { llmCostUSD: 0.5 } }); // would exceed if checked
    const r = await checkCostCaps({ agentName: "echo", userId: null, costLimits: limits, at });
    expect(r.allowed).toBe(true);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("treats a missing accounting row as zero spend", async () => {
    findUnique.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _sum: { llmCostUSD: null } });
    const r = await checkCostCaps({ agentName: "echo", userId: "u1", costLimits: limits, at });
    expect(r.allowed).toBe(true);
  });
});
