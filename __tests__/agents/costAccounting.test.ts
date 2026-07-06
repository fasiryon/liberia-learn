import { describe, it, expect, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentCostAccounting: {
      get upsert() {
        return upsert;
      },
    },
    agentInvocation: {
      get findMany() {
        return findMany;
      },
    },
  },
}));

import { recordSpend, dayKeyUTC } from "@/lib/agents/costAccounting";

describe("dayKeyUTC", () => {
  it("truncates a timestamp to a UTC midnight Date", () => {
    const d = dayKeyUTC(new Date("2026-07-06T17:50:20.276Z"));
    expect(d.toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });
});

describe("recordSpend", () => {
  beforeEach(() => {
    upsert.mockReset();
    findMany.mockReset();
    findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    upsert.mockResolvedValue({});
  });

  it("upserts the (agentName, date) row incrementing invocations and cost", async () => {
    await recordSpend({
      agentName: "echo",
      llmCostUSD: 0.0012,
      toolCostUnits: 3,
      at: new Date("2026-07-06T10:00:00.000Z"),
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({
      agentName_date: {
        agentName: "echo",
        date: new Date("2026-07-06T00:00:00.000Z"),
      },
    });
    expect(arg.create).toMatchObject({
      agentName: "echo",
      totalInvocations: 1,
      totalLlmCostUSD: 0.0012,
      totalToolCostUnits: 3,
    });
    expect(arg.update.totalInvocations).toEqual({ increment: 1 });
    expect(arg.update.totalLlmCostUSD).toEqual({ increment: 0.0012 });
    expect(arg.update.totalToolCostUnits).toEqual({ increment: 3 });
  });

  it("preserves at least 4 decimal places of USD precision", async () => {
    await recordSpend({
      agentName: "echo",
      llmCostUSD: 0.00012345,
      toolCostUnits: 0,
      at: new Date("2026-07-06T10:00:00.000Z"),
    });
    const arg = upsert.mock.calls[0][0];
    // 0.00012345 rounded to 6dp = 0.000123 — well beyond 4dp accuracy
    expect(arg.create.totalLlmCostUSD).toBeCloseTo(0.000123, 6);
    expect(arg.update.totalLlmCostUSD.increment).toBeCloseTo(0.000123, 6);
  });

  it("sets uniqueUsers from the distinct users of the day", async () => {
    await recordSpend({
      agentName: "echo",
      llmCostUSD: 0.001,
      toolCostUnits: 0,
      at: new Date("2026-07-06T10:00:00.000Z"),
    });
    const arg = upsert.mock.calls[0][0];
    expect(arg.create.uniqueUsers).toBe(2);
    expect(arg.update.uniqueUsers).toBe(2);
    // distinct query scoped to the same UTC day window
    expect(findMany).toHaveBeenCalledTimes(1);
    const q = findMany.mock.calls[0][0];
    expect(q.where.agentName).toBe("echo");
    expect(q.distinct).toEqual(["userId"]);
  });
});
