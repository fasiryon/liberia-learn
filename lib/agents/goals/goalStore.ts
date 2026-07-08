import { prisma } from "@/lib/db";
import type { GoalRecord, GoalStatus } from "@/lib/agents/goals/types";

export function mapGoalRow(row: any): GoalRecord {
  return {
    id: row.id,
    agentName: row.agentName,
    initiatedBy: row.initiatedBy,
    goalDescription: row.goalDescription,
    status: row.status as GoalStatus,
    state: (row.state ?? {}) as Record<string, unknown>,
    pauseReason: row.pauseReason ?? null,
    pauseUntil: row.pauseUntil ?? null,
    humanReviewRequired: Boolean(row.humanReviewRequired),
    stepCount: row.stepCount ?? 0,
    lastError: row.lastError ?? null,
  };
}

export async function createGoal(input: {
  agentName: string;
  initiatedBy: string;
  goalDescription: string;
  state?: Record<string, unknown>;
}): Promise<GoalRecord> {
  const row = await prisma.agentGoal.create({
    data: {
      agentName: input.agentName,
      initiatedBy: input.initiatedBy,
      goalDescription: input.goalDescription,
      state: (input.state ?? {}) as object,
      status: "OPEN",
    },
  });
  return mapGoalRow(row);
}

export async function getGoal(id: string): Promise<GoalRecord | null> {
  const row = await prisma.agentGoal.findUnique({ where: { id } });
  return row ? mapGoalRow(row) : null;
}
