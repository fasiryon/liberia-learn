import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { startExecutionTrace, finishExecutionTrace } from "@/lib/autonomous/executionTraceService";
import type { RecommendationEvaluation } from "@/lib/autonomous/evaluation/types";

export async function recordEvaluationTrace(input: {
  evaluation: RecommendationEvaluation;
  schoolId?: string | null;
  districtId?: string | null;
  traceId?: string | null;
  actorId?: string | null;
  isReplay?: boolean;
}) {
  const trace = (await startExecutionTrace({
    traceId: input.traceId ?? `evaluation_${input.evaluation.agentDecisionId}`,
    workflowRunId: input.evaluation.workflowRunId,
    spanType: "evaluation",
    spanName: input.evaluation.decisionType,
    schoolId: input.schoolId ?? null,
    actorType: "evaluation",
    actorId: input.actorId ?? "evaluationService",
    metadata: { evaluation: input.evaluation },
  })) as any;
  await finishExecutionTrace({ id: trace.id, status: "succeeded" });
  await Promise.all([
    logLearningEvent({
      workflowRunId: input.evaluation.workflowRunId,
      workflowTraceId: input.traceId ?? null,
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      actor: { type: "system", id: "evaluationService" },
      target: { type: "AgentDecision", id: input.evaluation.agentDecisionId },
      eventType: "autonomous.evaluation.recorded",
      source: "autonomous.evaluation",
      status: input.evaluation.outcome,
      isReplay: input.isReplay === true,
      metadata: { ...input.evaluation },
    }),
    logAudit({
      userId: input.actorId ?? null,
      action: "autonomous.evaluation.recorded",
      resourceType: "AgentDecision",
      resourceId: input.evaluation.agentDecisionId,
      traceId: input.traceId ?? null,
      schoolId: input.schoolId ?? null,
      details: {
        outcome: input.evaluation.outcome,
        confidenceAfter: input.evaluation.confidenceAfter,
        evaluationVersion: input.evaluation.evaluationVersion,
      },
    }),
  ]);
}

