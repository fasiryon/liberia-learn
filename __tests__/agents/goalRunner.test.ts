import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    agentGoal: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import { registerGoalHandler } from "@/lib/agents/goals/goalRegistry";
import { advanceGoal, resumeGoal } from "@/lib/agents/goals/goalRunner";
import type { GoalStepResult } from "@/lib/agents/goals/types";

let nextResult: GoalStepResult;
let lastCtx: unknown;
registerGoalHandler("goal-test", async (ctx) => {
  lastCtx = ctx;
  return nextResult;
});

function goalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    agentName: "goal-test",
    initiatedBy: "u1",
    goalDescription: "test goal",
    status: "OPEN",
    state: { count: 0 },
    pauseReason: null,
    pauseUntil: null,
    humanReviewRequired: false,
    stepCount: 0,
    lastError: null,
    ...overrides,
  };
}

describe("advanceGoal", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...goalRow(), ...data }));
  });

  it("continue → keeps IN_PROGRESS, increments stepCount, merges state", async () => {
    findUnique.mockResolvedValue(goalRow());
    nextResult = { kind: "continue", state: { count: 1 } };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("IN_PROGRESS");
    const data = update.mock.calls.at(-1)![0].data;
    expect(data.status).toBe("IN_PROGRESS");
    expect(data.stepCount).toBe(1);
    expect(data.state).toEqual({ count: 1 });
  });

  it("pause_human → PAUSED_FOR_HUMAN with humanReviewRequired", async () => {
    findUnique.mockResolvedValue(goalRow());
    nextResult = { kind: "pause_human", reason: "need parent phone" };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("PAUSED_FOR_HUMAN");
    const data = update.mock.calls.at(-1)![0].data;
    expect(data.humanReviewRequired).toBe(true);
    expect(data.pauseReason).toBe("need parent phone");
  });

  it("pause_schedule → PAUSED_FOR_SCHEDULE with pauseUntil", async () => {
    findUnique.mockResolvedValue(goalRow());
    const until = new Date(Date.now() + 3_600_000);
    nextResult = { kind: "pause_schedule", until, reason: "wait for tomorrow" };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("PAUSED_FOR_SCHEDULE");
    expect(update.mock.calls.at(-1)![0].data.pauseUntil).toEqual(until);
  });

  it("complete → COMPLETED with completedAt", async () => {
    findUnique.mockResolvedValue(goalRow());
    nextResult = { kind: "complete" };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("COMPLETED");
    expect(update.mock.calls.at(-1)![0].data.completedAt).toBeInstanceOf(Date);
  });

  it("fail → FAILED with lastError", async () => {
    findUnique.mockResolvedValue(goalRow());
    nextResult = { kind: "fail", reason: "unreachable guardian" };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("FAILED");
    expect(update.mock.calls.at(-1)![0].data.lastError).toBe("unreachable guardian");
  });

  it("a throwing handler → FAILED with the error message", async () => {
    findUnique.mockResolvedValue(goalRow());
    nextResult = undefined as never;
    registerGoalHandler("goal-throw", async () => {
      throw new Error("boom");
    });
    findUnique.mockResolvedValue(goalRow({ agentName: "goal-throw" }));
    const r = await advanceGoal("g1");
    expect(r.status).toBe("FAILED");
    expect(update.mock.calls.at(-1)![0].data.lastError).toMatch(/boom/);
  });

  it("does not advance a terminal (COMPLETED) goal", async () => {
    findUnique.mockResolvedValue(goalRow({ status: "COMPLETED" }));
    const r = await advanceGoal("g1");
    expect(r.advanced).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not advance a scheduled goal before its wake time", async () => {
    findUnique.mockResolvedValue(
      goalRow({ status: "PAUSED_FOR_SCHEDULE", pauseUntil: new Date(Date.now() + 60_000) })
    );
    const r = await advanceGoal("g1");
    expect(r.advanced).toBe(false);
    expect(r.reason).toMatch(/not_due/);
  });

  it("advances a scheduled goal once its wake time has passed", async () => {
    findUnique.mockResolvedValue(
      goalRow({ status: "PAUSED_FOR_SCHEDULE", pauseUntil: new Date(Date.now() - 60_000) })
    );
    nextResult = { kind: "complete" };
    const r = await advanceGoal("g1");
    expect(r.advanced).toBe(true);
    expect(r.status).toBe("COMPLETED");
  });

  it("fails the goal when the max step count is exceeded", async () => {
    findUnique.mockResolvedValue(goalRow({ stepCount: 50 }));
    nextResult = { kind: "continue" };
    const r = await advanceGoal("g1");
    expect(r.status).toBe("FAILED");
    expect(update.mock.calls.at(-1)![0].data.lastError).toMatch(/max_steps/);
  });
});

describe("resumeGoal", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...goalRow(), ...data }));
  });

  it("resumes a PAUSED_FOR_HUMAN goal and advances one step with the human input", async () => {
    findUnique.mockResolvedValue(goalRow({ status: "PAUSED_FOR_HUMAN", humanReviewRequired: true }));
    nextResult = { kind: "complete" };
    const r = await resumeGoal("g1", { parentPhone: "+231770000111" });
    expect(r.status).toBe("COMPLETED");
    expect((lastCtx as { resumeInput?: unknown }).resumeInput).toEqual({ parentPhone: "+231770000111" });
  });

  it("throws when resuming a goal that is not awaiting human input", async () => {
    findUnique.mockResolvedValue(goalRow({ status: "IN_PROGRESS" }));
    await expect(resumeGoal("g1", {})).rejects.toThrow(/not.*human|awaiting/i);
  });
});
