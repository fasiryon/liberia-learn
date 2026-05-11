import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isImplementationWorkflowEnabled } from "@/lib/serverFlags";
import { recordOperationalMemory } from "@/lib/autonomous/memory/operationalMemoryService";
import { aggregatePostChangeOutcomes } from "@/lib/autonomous/optimization/postChangeOutcomeAggregator";
import { generateImplementationFindings } from "@/lib/autonomous/optimization/implementationOutcomeService";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

function hasLineage(metrics: any) {
  return Array.isArray(metrics?.lineageRefs) && metrics.lineageRefs.length > 0;
}

export async function completeFeedbackLoop(input: {
  evaluationPlanId: string;
  actorId?: string | null;
  isReplay?: boolean;
}) {
  if (!isImplementationWorkflowEnabled()) {
    throw Object.assign(new Error("Implementation workflow is disabled"), { status: 404 });
  }
  const plan = await (prisma as any).postChangeEvaluationPlan.findUnique({
    where: { id: input.evaluationPlanId },
    include: { changeRequest: true },
  });
  if (!plan) throw Object.assign(new Error("Post-change evaluation plan not found"), { status: 404 });
  const rolloutPlan = await (prisma as any).stagedRolloutPlan.findUnique({ where: { changeRequestId: plan.changeRequestId } });
  if (!rolloutPlan?.rolloutVerification) {
    throw Object.assign(new Error("Evaluation closure requires rollout verification"), { status: 422, code: "rollout_verification_required" });
  }
  if (!plan.baselineMetrics) {
    throw Object.assign(new Error("Evaluation closure requires baseline metrics"), { status: 422, code: "baseline_required" });
  }

  const actualMetrics = plan.postChangeMetrics ?? await aggregatePostChangeOutcomes({
    schoolId: plan.changeRequest?.schoolId ?? null,
    districtId: plan.changeRequest?.districtId ?? null,
    evaluationWindowDays: plan.evaluationWindowDays,
  });
  if (!actualMetrics || !hasLineage(actualMetrics)) {
    throw Object.assign(new Error("Feedback loop cannot complete without persisted outcome records and lineage"), { status: 422, code: "outcome_lineage_required" });
  }
  const findings = generateImplementationFindings({ baselineMetrics: plan.baselineMetrics, actualMetrics });
  if (input.isReplay) return { plan, actualMetrics, findings, replay: true };

  const overallOutcome = findings.overallOutcome;
  const confidenceScore = findings.effectiveness.confidence;
  const evaluationWindowClosedAt = new Date();

  const updated = await withDbWriteThrottle("implementation.feedbackLoop.complete", () =>
    (prisma as any).postChangeEvaluationPlan.update({
      where: { id: plan.id },
      data: {
        postChangeMetrics: actualMetrics,
        findings,
        status: "CLOSED",
        feedbackLoopStatus: "COMPLETE",
        overallOutcome,
        confidenceScore,
        evaluationWindowClosedAt,
        updatedAt: new Date(),
      },
    })
  );

  await withDbWriteThrottle("implementation.cr.outcome", () =>
    (prisma as any).optimizationChangeRequest.update({
      where: { id: plan.changeRequestId },
      data: { implementationOutcome: overallOutcome, updatedAt: new Date() },
    })
  );

  const event = await logLearningEvent(
    {
      workflowTraceId: plan.traceId ?? null,
      schoolId: plan.changeRequest?.schoolId ?? null,
      districtId: plan.changeRequest?.districtId ?? null,
      actor: { type: "system", id: "feedbackLoopCompletionService" },
      target: { type: "PostChangeEvaluationPlan", id: plan.id },
      eventType: "autonomous.implementation.feedback_loop.completed",
      source: "autonomous.implementation",
      status: "COMPLETE",
      metadata: {
        changeRequestId: plan.changeRequestId,
        actualMetrics,
        findings,
        lineageRefs: actualMetrics.lineageRefs,
        advisoryOnly: true,
        policyMutation: false,
      },
    },
    { throwOnError: true }
  );

  try {
    await recordOperationalMemory({
      memoryType: plan.changeRequest?.schoolId ? "SCHOOL_PATTERN" : "NATIONAL_PATTERN",
      scope: plan.changeRequest?.schoolId ? "school" : "national",
      schoolId: plan.changeRequest?.schoolId ?? null,
      districtId: plan.changeRequest?.districtId ?? null,
      targetType: "PostChangeEvaluationPlan",
      targetId: plan.id,
      summary: `Implementation feedback loop closed with findings: ${findings.findings.join(", ")}. Effectiveness score ${findings.effectiveness.effectivenessScore}.`,
      evidenceRefs: { refs: actualMetrics.lineageRefs, closureEventId: (event as any)?.id ?? null },
      lineage: {
        evaluationPlanId: plan.id,
        changeRequestId: plan.changeRequestId,
        rolloutVerification: rolloutPlan.rolloutVerification,
        learningEventId: (event as any)?.id ?? null,
      },
      confidence: findings.effectiveness.confidence,
      sensitivity: plan.changeRequest?.schoolId ? "tenant" : "aggregate",
      actorId: input.actorId ?? null,
    });
  } catch (memErr: any) {
    // Memory recording is best-effort. If ENABLE_AUTONOMOUS_MEMORY is disabled, do not
    // block the feedback loop closure — the findings are already persisted to the DB.
    if (memErr?.code !== "autonomous_memory_disabled") throw memErr;
  }

  return { plan: updated, actualMetrics, findings, event };
}
