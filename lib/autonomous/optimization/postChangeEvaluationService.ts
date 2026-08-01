import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordConfigChangeAudit } from "@/lib/autonomous/optimization/configChangeAuditService";
import { aggregatePostChangeOutcomes } from "@/lib/autonomous/optimization/postChangeOutcomeAggregator";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type EvalActor = {
  id: string;
  role?: string | null;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

// Capture deterministic baseline metrics from existing evaluation infrastructure.
async function captureBaselineMetrics(schoolId: string | null): Promise<Record<string, unknown>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where: any = { eventType: "autonomous.evaluation.recorded", occurredAt: { gte: thirtyDaysAgo } };
  if (schoolId) where.schoolId = schoolId;

  const evalEvents = await (prisma as any).learningEvent.findMany({ where, take: 500 });
  const fpEvents = evalEvents.filter((e: any) => e.metadata?.outcome === "false_positive");
  const tpEvents = evalEvents.filter((e: any) => e.metadata?.outcome === "true_positive");
  const total = evalEvents.length;

  const falsePositiveRate = total > 0 ? fpEvents.length / total : null;
  const precision = total > 0 ? tpEvents.length / total : null;

  const approvalEvents = await (prisma as any).learningEvent.findMany({
    where: { eventType: "autonomous.action.approved", occurredAt: { gte: thirtyDaysAgo }, ...(schoolId ? { schoolId } : {}) },
    take: 200,
  });
  const rejectionEvents = await (prisma as any).learningEvent.findMany({
    where: { eventType: "autonomous.action.rejected", occurredAt: { gte: thirtyDaysAgo }, ...(schoolId ? { schoolId } : {}) },
    take: 200,
  });
  const approvalTotal = approvalEvents.length + rejectionEvents.length;
  const approvalRejectionRate = approvalTotal > 0 ? rejectionEvents.length / approvalTotal : null;

  return {
    capturedAt: new Date().toISOString(),
    windowDays: 30,
    sampleSize: total + approvalTotal,
    totalEvaluationEvents: total,
    detectorPrecision: precision,
    falsePositiveRate,
    falseNegativeRate: null,
    evidenceCoverage: null,
    approvalRejectionRate,
    recommendationAcceptanceRate: null, // Requires additional acceptance tracking
    rolloutStability: null,
    workflowStability: null,
    operationalEffectivenessDelta: null,
    sparseData: total < 3,
    confidenceMultiplier: total < 3 ? 0.55 : 1,
  };
}

export async function createPostChangeEvaluationPlan(input: {
  changeRequestId: string;
  actor: EvalActor;
  evaluationWindowDays?: number;
  traceId?: string | null;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }

  const changeRequest = await (prisma as any).optimizationChangeRequest.findUnique({ where: { id: input.changeRequestId } });
  if (!changeRequest) throw Object.assign(new Error("Change request not found"), { status: 404 });

  if (!input.actor.isPlatformAdmin && !(changeRequest.schoolId && input.actor.role === "ADMIN" && input.actor.schoolId === changeRequest.schoolId)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  // Require that a rollout verification exists before creating post-change eval plan.
  const rolloutPlan = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: input.changeRequestId } });
  if (!rolloutPlan?.rolloutVerification) {
    throw Object.assign(new Error("Cannot create post-change evaluation plan without a recorded rollout verification"), { status: 422, code: "rollout_verification_required" });
  }

  const existing = await (prisma as any).postChangeEvaluationPlan.findUnique({ where: { changeRequestId: input.changeRequestId } });
  if (existing) return existing;

  const baseline = await captureBaselineMetrics(changeRequest.schoolId);

  const evalPlan: any = await withDbWriteThrottle("implementation.postChangeEval", () =>
    (prisma as any).postChangeEvaluationPlan.create({
      data: {
        changeRequestId: input.changeRequestId,
        evaluationWindowDays: input.evaluationWindowDays ?? 14,
        status: "BASELINE_RECORDED",
        baselineMetrics: baseline,
        detectorPrecisionBaseline: typeof baseline.detectorPrecision === "number" ? baseline.detectorPrecision : null,
        falsePositiveRateBaseline: typeof baseline.falsePositiveRate === "number" ? baseline.falsePositiveRate : null,
        recommendationAcceptanceBaseline: typeof baseline.recommendationAcceptanceRate === "number" ? baseline.recommendationAcceptanceRate : null,
        approvalRejectionBaseline: typeof baseline.approvalRejectionRate === "number" ? baseline.approvalRejectionRate : null,
        feedbackLoopStatus: "pending",
        createdBy: input.actor.id,
        traceId: input.traceId ?? null,
      },
    })
  );

  await withDbWriteThrottle("implementation.cr.completed", () =>
    (prisma as any).optimizationChangeRequest.update({
      where: { id: input.changeRequestId },
      data: { status: "COMPLETED", implementationStatus: "EVALUATION_PENDING", updatedAt: new Date() },
    })
  );

  await logLearningEvent(
    {
      workflowTraceId: input.traceId ?? null,
      schoolId: changeRequest.schoolId,
      actor: { type: "user", id: input.actor.id, role: input.actor.role },
      target: { type: "PostChangeEvaluationPlan", id: evalPlan.id },
      eventType: "autonomous.implementation.post_change_eval.created",
      source: "autonomous.implementation",
      status: "BASELINE_RECORDED",
      metadata: {
        changeRequestId: input.changeRequestId,
        evalPlanId: evalPlan.id,
        evaluationWindowDays: evalPlan.evaluationWindowDays,
        baseline,
        feedbackTarget: "evaluationLayer + operationalMemory",
        policyMutation: false,
      },
    },
    { throwOnError: true }
  );

  await recordConfigChangeAudit({
    actorId: input.actor.id,
    action: "post_change_eval.created",
    changeRequestId: input.changeRequestId,
    proposalEventId: changeRequest.proposalEventId,
    category: changeRequest.category,
    affectedScope: changeRequest.affectedScope,
    schoolId: changeRequest.schoolId,
    traceId: input.traceId ?? null,
    details: { evalPlanId: evalPlan.id, evaluationWindowDays: evalPlan.evaluationWindowDays },
  });

  return evalPlan;
}

export async function getPostChangeEvaluationPlan(changeRequestId: string, actor: EvalActor) {
  const evalPlan = await (prisma as any).postChangeEvaluationPlan.findUnique({
    where: { changeRequestId },
    include: { changeRequest: { select: { schoolId: true } } },
  });
  if (!evalPlan) return null;

  const schoolId = evalPlan.changeRequest?.schoolId ?? null;
  if (!actor.isPlatformAdmin && !(schoolId && actor.role === "ADMIN" && actor.schoolId === schoolId) && actor.role !== "MOE_OFFICIAL") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const { changeRequest, ...plan } = evalPlan;
  return plan;
}

export async function recordPostChangeMetrics(input: {
  evaluationPlanId?: string;
  changeRequestId?: string;
  actorId?: string | null;
  force?: boolean;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }
  const where = input.evaluationPlanId ? { id: input.evaluationPlanId } : { changeRequestId: input.changeRequestId };
  const evalPlan = await (prisma as any).postChangeEvaluationPlan.findUnique({
    where,
    include: { changeRequest: true },
  });
  if (!evalPlan) throw Object.assign(new Error("Post-change evaluation plan not found"), { status: 404 });
  if (!evalPlan.baselineMetrics) {
    throw Object.assign(new Error("Cannot record post-change metrics without baseline metrics"), { status: 422, code: "baseline_required" });
  }

  const rolloutPlan = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: evalPlan.changeRequestId } });
  if (!rolloutPlan?.rolloutVerification) {
    throw Object.assign(new Error("Post-change metrics require rollout verification"), { status: 422, code: "rollout_verification_required" });
  }

  const createdAt = new Date(evalPlan.createdAt);
  const windowMs = evalPlan.evaluationWindowDays * 24 * 60 * 60 * 1000;
  const windowClosed = Date.now() >= createdAt.getTime() + windowMs;
  const status = windowClosed ? "ACTUALS_RECORDED" : "INCOMPLETE_DATA";
  const actualMetrics = await aggregatePostChangeOutcomes({
    schoolId: evalPlan.changeRequest?.schoolId ?? null,
    districtId: evalPlan.changeRequest?.districtId ?? null,
    evaluationWindowDays: evalPlan.evaluationWindowDays,
  });

  if (!input.force && !windowClosed && actualMetrics.sampleSize === 0) {
    throw Object.assign(new Error("Evaluation window is still open and no actual outcome records are available"), {
      status: 422,
      code: "evaluation_window_open",
    });
  }

  const updated = await withDbWriteThrottle("implementation.postChangeMetrics", () =>
    (prisma as any).postChangeEvaluationPlan.update({
      where: { id: evalPlan.id },
      data: {
        postChangeMetrics: actualMetrics,
        status,
        feedbackLoopStatus: windowClosed ? "actuals_recorded" : "collecting",
        updatedAt: new Date(),
      },
    })
  );

  await logLearningEvent(
    {
      workflowTraceId: evalPlan.traceId ?? null,
      schoolId: evalPlan.changeRequest?.schoolId ?? null,
      districtId: evalPlan.changeRequest?.districtId ?? null,
      actor: { type: "system", id: "postChangeEvaluationService" },
      target: { type: "PostChangeEvaluationPlan", id: evalPlan.id },
      eventType: "autonomous.implementation.post_change_metrics.recorded",
      source: "autonomous.implementation",
      status,
      metadata: {
        changeRequestId: evalPlan.changeRequestId,
        actualMetrics,
        sparseData: actualMetrics.sparseData,
        confidenceMultiplier: actualMetrics.confidenceMultiplier,
        policyMutation: false,
        advisoryOnly: true,
      },
    },
    { throwOnError: true }
  );

  return updated;
}
