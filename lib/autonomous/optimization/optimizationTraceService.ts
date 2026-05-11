import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { startExecutionTrace, finishExecutionTrace } from "@/lib/autonomous/executionTraceService";
import type { OptimizationRecommendation, OptimizationReviewStatus } from "@/lib/autonomous/optimization/types";

export async function recordOptimizationProposal(input: {
  recommendation: OptimizationRecommendation;
  actorId?: string | null;
  traceId?: string | null;
  isReplay?: boolean;
}) {
  const traceId = input.traceId ?? `optimization_${input.recommendation.idempotencyKey}`;
  const trace = (await startExecutionTrace({
    traceId,
    spanType: "optimization",
    spanName: input.recommendation.category,
    schoolId: input.recommendation.schoolId ?? null,
    actorType: "optimization",
    actorId: input.actorId ?? "optimizationEngine",
    metadata: { recommendation: input.recommendation, reviewRequired: true },
  })) as any;
  await finishExecutionTrace({ id: trace.id, status: "succeeded" });
  const event = await logLearningEvent(
    {
      workflowTraceId: traceId,
      schoolId: input.recommendation.schoolId ?? null,
      districtId: input.recommendation.districtId ?? null,
      actor: { type: "system", id: "optimizationEngine" },
      target: { type: "OptimizationRecommendation", id: input.recommendation.targetId ?? input.recommendation.category },
      eventType: "autonomous.optimization.proposed",
      source: "autonomous.optimization",
      status: "PENDING_REVIEW",
      dedupeKey: input.recommendation.idempotencyKey,
      isReplay: input.isReplay === true,
      metadata: { ...input.recommendation, reviewStatus: "PENDING_REVIEW", applied: false },
    },
    { throwOnError: true }
  );
  await logAudit({
    userId: input.actorId ?? null,
    action: "autonomous.optimization.proposed",
    resourceType: "LearningEvent",
    resourceId: (event as any)?.id ?? null,
    traceId,
    schoolId: input.recommendation.schoolId ?? null,
    details: {
      category: input.recommendation.category,
      confidence: input.recommendation.confidence,
      approvalRequirement: input.recommendation.approvalRequirement,
      applied: false,
    },
  });
  return event;
}

export async function recordOptimizationReview(input: {
  proposalEvent: any;
  status: Exclude<OptimizationReviewStatus, "PENDING_REVIEW">;
  reviewer: { id: string; role?: string | null; isPlatformAdmin?: boolean; schoolId?: string | null };
  comment?: string | null;
}) {
  const metadata = input.proposalEvent.metadata ?? {};
  const event = await logLearningEvent(
    {
      workflowTraceId: input.proposalEvent.workflowTraceId ?? null,
      schoolId: input.proposalEvent.schoolId ?? null,
      districtId: input.proposalEvent.districtId ?? null,
      actor: { type: "user", id: input.reviewer.id, role: input.reviewer.role },
      target: { type: "OptimizationRecommendation", id: input.proposalEvent.id },
      eventType: "autonomous.optimization.reviewed",
      source: "autonomous.optimization",
      status: input.status,
      metadata: {
        proposalEventId: input.proposalEvent.id,
        category: metadata.category,
        reviewStatus: input.status,
        comment: input.comment ?? null,
        applied: false,
        policySafety: "review_event_only_no_policy_mutation",
      },
    },
    { throwOnError: true }
  );
  await logAudit({
    userId: input.reviewer.id,
    action: `autonomous.optimization.${input.status.toLowerCase()}`,
    resourceType: "LearningEvent",
    resourceId: input.proposalEvent.id,
    traceId: input.proposalEvent.workflowTraceId ?? null,
    schoolId: input.proposalEvent.schoolId ?? null,
    details: { comment: input.comment ?? null, applied: false },
  });
  return event;
}
