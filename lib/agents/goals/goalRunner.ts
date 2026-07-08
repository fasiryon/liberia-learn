import { prisma } from "@/lib/db";
import { getGoalHandler } from "@/lib/agents/goals/goalRegistry";
import { mapGoalRow } from "@/lib/agents/goals/goalStore";
import type { AdvanceResult, GoalStepResult } from "@/lib/agents/goals/types";

/** Hard cap on goal steps to prevent a runaway "continue" loop. */
export const MAX_GOAL_STEPS = 50;

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

interface AdvanceOptions {
  resumeInput?: Record<string, unknown> | null;
  now?: Date;
}

/**
 * Take one step of a goal: read state, run the agent's goal handler, apply the
 * resulting transition. One step per call — the scheduler tick drives repeated
 * advancement so a "continue" cannot spin.
 */
export async function advanceGoal(
  goalId: string,
  opts: AdvanceOptions = {}
): Promise<AdvanceResult> {
  const row = await prisma.agentGoal.findUnique({ where: { id: goalId } });
  if (!row) throw Object.assign(new Error(`Goal not found: ${goalId}`), { status: 404 });
  const goal = mapGoalRow(row);
  const now = opts.now ?? new Date();

  if (TERMINAL.has(goal.status)) {
    return { advanced: false, status: goal.status, reason: "terminal" };
  }
  if (goal.status === "PAUSED_FOR_HUMAN" && !opts.resumeInput) {
    return { advanced: false, status: goal.status, reason: "awaiting_human" };
  }
  if (
    goal.status === "PAUSED_FOR_SCHEDULE" &&
    goal.pauseUntil &&
    goal.pauseUntil.getTime() > now.getTime()
  ) {
    return { advanced: false, status: goal.status, reason: "not_due" };
  }

  const handler = getGoalHandler(goal.agentName);
  let result: GoalStepResult;
  try {
    result = await handler({ goal, resumeInput: opts.resumeInput ?? null });
  } catch (e) {
    result = { kind: "fail", reason: e instanceof Error ? e.message : String(e) };
  }

  const nextStepCount = goal.stepCount + 1;
  // Runaway guard: a continue that would exceed the cap fails instead.
  if (result.kind === "continue" && nextStepCount > MAX_GOAL_STEPS) {
    result = { kind: "fail", reason: "max_steps_exceeded", state: result.state };
  }

  const mergedState = { ...goal.state, ...(result.state ?? {}) };
  const data: Record<string, any> = { state: mergedState, stepCount: nextStepCount };

  switch (result.kind) {
    case "continue":
      data.status = "IN_PROGRESS";
      data.pauseReason = null;
      data.pauseUntil = null;
      data.humanReviewRequired = false;
      break;
    case "pause_human":
      data.status = "PAUSED_FOR_HUMAN";
      data.humanReviewRequired = true;
      data.pauseReason = result.reason;
      data.pauseUntil = null;
      break;
    case "pause_schedule":
      data.status = "PAUSED_FOR_SCHEDULE";
      data.pauseUntil = result.until;
      data.pauseReason = result.reason ?? null;
      data.humanReviewRequired = false;
      break;
    case "complete":
      data.status = "COMPLETED";
      data.completedAt = now;
      data.humanReviewRequired = false;
      data.pauseReason = null;
      break;
    case "fail":
      data.status = "FAILED";
      data.lastError = result.reason;
      data.humanReviewRequired = false;
      break;
  }

  await prisma.agentGoal.update({ where: { id: goalId }, data });
  return { advanced: true, status: data.status };
}

/**
 * Human resume: a PAUSED_FOR_HUMAN goal receives operator/user input and takes
 * one step with it. Throws 409 if the goal is not awaiting human input.
 */
export async function resumeGoal(
  goalId: string,
  humanInput: Record<string, unknown>,
  opts: { now?: Date } = {}
): Promise<AdvanceResult> {
  const row = await prisma.agentGoal.findUnique({ where: { id: goalId } });
  if (!row) throw Object.assign(new Error(`Goal not found: ${goalId}`), { status: 404 });
  const goal = mapGoalRow(row);
  if (goal.status !== "PAUSED_FOR_HUMAN") {
    throw Object.assign(new Error("Goal is not awaiting human input"), { status: 409 });
  }
  return advanceGoal(goalId, { resumeInput: humanInput ?? {}, now: opts.now });
}
