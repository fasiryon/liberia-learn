import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const advanceGoal = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { agentGoal: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/lib/agents/goals/goalRunner", () => ({
  advanceGoal: (...a: unknown[]) => advanceGoal(...a),
}));

import { tickGoals } from "@/lib/agents/goals/tick";

describe("tickGoals", () => {
  beforeEach(() => {
    findMany.mockReset();
    advanceGoal.mockReset();
    advanceGoal.mockResolvedValue({ advanced: true, status: "IN_PROGRESS" });
  });

  it("advances every runnable goal and reports a summary", async () => {
    findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    const now = new Date("2026-07-08T10:00:00Z");
    const r = await tickGoals({ now });
    expect(advanceGoal).toHaveBeenCalledTimes(2);
    expect(advanceGoal).toHaveBeenCalledWith("g1", { now });
    expect(r.advanced).toBe(2);
  });

  it("selects OPEN, IN_PROGRESS, and due PAUSED_FOR_SCHEDULE goals", async () => {
    findMany.mockResolvedValue([]);
    const now = new Date("2026-07-08T10:00:00Z");
    await tickGoals({ now });
    const where = findMany.mock.calls[0][0].where;
    const statuses = where.OR.map((c: { status: string }) => c.status);
    expect(statuses).toEqual(expect.arrayContaining(["OPEN", "IN_PROGRESS", "PAUSED_FOR_SCHEDULE"]));
    const scheduled = where.OR.find((c: { status: string }) => c.status === "PAUSED_FOR_SCHEDULE");
    expect(scheduled.pauseUntil.lte).toEqual(now);
  });

  it("continues past a goal that throws during advance", async () => {
    findMany.mockResolvedValue([{ id: "g1" }, { id: "g2" }]);
    advanceGoal.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ advanced: true, status: "COMPLETED" });
    const r = await tickGoals({ now: new Date() });
    expect(r.advanced).toBe(1);
    expect(r.failed).toBe(1);
  });
});
