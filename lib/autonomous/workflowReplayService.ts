import { prisma } from "@/lib/db";
import { createWorkflowRun } from "@/lib/autonomous/workflowStateManager";
import type { WorkflowReplayMode } from "@/lib/autonomous/types";

export async function getWorkflowReplayPlan(workflowRunId: string) {
  const [workflowRun, checkpoints, steps, decisions, actions] = await Promise.all([
    (prisma as any).workflowRun.findUnique({ where: { id: workflowRunId } }),
    (prisma as any).workflowCheckpoint.findMany({
      where: { workflowRunId },
      orderBy: { sequence: "asc" },
    }),
    (prisma as any).workflowStep.findMany({
      where: { workflowRunId },
      orderBy: { sequence: "asc" },
    }),
    (prisma as any).agentDecision.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: "asc" },
    }),
    (prisma as any).actionExecution.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!workflowRun) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });

  return {
    workflowRun,
    replaySafe: actions.length === 0 || actions.every((action: any) => action.status !== "succeeded"),
    sideEffectsBlockedByDefault: true,
    checkpoints,
    steps,
    decisions,
    actions,
  };
}

export async function createReplayWorkflowRun(input: {
  workflowRunId: string;
  requestedByUserId?: string | null;
  replayMode?: WorkflowReplayMode;
}) {
  const plan = await getWorkflowReplayPlan(input.workflowRunId);
  const original = plan.workflowRun;
  const replayMode = input.replayMode ?? "analysis_only";
  if (replayMode !== "analysis_only" && !plan.replaySafe) {
    throw Object.assign(new Error("Action replay requires explicit approval and safe action state"), {
      status: 409,
      code: "workflow_replay_side_effect_guard",
    });
  }

  return createWorkflowRun({
    workflowType: original.workflowType,
    tenantId: original.tenantId,
    schoolId: original.schoolId,
    districtId: original.districtId,
    source: "workflow.replay",
    targetType: original.targetType,
    targetId: original.targetId,
    triggerEventId: original.triggerEventId,
    riskLevel: original.riskLevel,
    approvalRequired: replayMode === "approved_action_replay",
    replayOfRunId: original.id,
    replayMode,
    replaySequence: (original.replaySequence ?? 0) + 1,
    isReplay: true,
    evidenceRefs: { replayOfRunId: original.id, requestedByUserId: input.requestedByUserId ?? null },
    executionMetadata: { sideEffectsBlockedByDefault: replayMode !== "approved_action_replay" },
  });
}

