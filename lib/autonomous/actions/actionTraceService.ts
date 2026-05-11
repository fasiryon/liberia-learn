import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { recordWorkflowCheckpoint } from "@/lib/autonomous/workflowStateManager";
import { startExecutionTrace, finishExecutionTrace } from "@/lib/autonomous/executionTraceService";
import type { GovernedActionStatus } from "@/lib/autonomous/actions/types";

export async function recordActionTrace(input: {
  workflowRunId: string;
  actionExecutionId: string;
  actionType: string;
  status: GovernedActionStatus;
  traceId?: string | null;
  schoolId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const trace = (await startExecutionTrace({
    traceId: input.traceId ?? `action_${input.actionExecutionId}`,
    workflowRunId: input.workflowRunId,
    spanType: "action",
    spanName: input.actionType,
    schoolId: input.schoolId ?? null,
    actorType: "action",
    actorId: input.actorId ?? input.actionType,
    metadata: { actionExecutionId: input.actionExecutionId, status: input.status, ...(input.metadata ?? {}) },
  })) as any;
  await finishExecutionTrace({ id: trace.id, status: input.status === "FAILED" ? "failed" : "succeeded" });
  await recordWorkflowCheckpoint({
    workflowRunId: input.workflowRunId,
    checkpointKey: `action_${input.status.toLowerCase()}`,
    traceId: input.traceId ?? null,
    actorType: "action",
    actorId: input.actionType,
    executionMetadata: { actionExecutionId: input.actionExecutionId, actionType: input.actionType, ...(input.metadata ?? {}) },
  });
  await Promise.all([
    logLearningEvent({
      workflowRunId: input.workflowRunId,
      workflowTraceId: input.traceId ?? null,
      schoolId: input.schoolId ?? null,
      actor: { type: "action", id: input.actionType },
      target: { type: "ActionExecution", id: input.actionExecutionId },
      eventType: input.status === "EXECUTED" ? "action.executed" : "action.proposed",
      source: "autonomous.actions",
      status: input.status,
      metadata: { actionType: input.actionType, ...(input.metadata ?? {}) },
    }),
    logAudit({
      userId: input.actorId ?? null,
      action: `action.${input.status.toLowerCase()}`,
      resourceType: "ActionExecution",
      resourceId: input.actionExecutionId,
      traceId: input.traceId ?? null,
      schoolId: input.schoolId ?? null,
      details: { actionType: input.actionType, ...(input.metadata ?? {}) },
    }),
  ]);
}
