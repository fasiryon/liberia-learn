import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isDetectorRecommendationGenerationEnabled } from "@/lib/serverFlags";
import type { JsonObject } from "@/lib/autonomous/types";
import type { RecommendationRecordInput } from "@/lib/autonomous/detectors/types";

export function buildRecommendationIdempotencyKey(input: {
  detectorId: string;
  targetType: string;
  targetId: string;
  schoolId?: string | null;
  districtId?: string | null;
  windowKey: string;
  findingType: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.detectorId,
        input.schoolId ?? "national",
        input.districtId ?? "none",
        input.targetType,
        input.targetId,
        input.windowKey,
        input.findingType,
      ].join("|")
    )
    .digest("hex");
}

export function buildRecommendationPayload(input: RecommendationRecordInput): JsonObject {
  return {
    detectorId: input.detectorId,
    recommendationOnly: true,
    targetType: input.targetType,
    targetId: input.targetId,
    windowKey: input.windowKey,
    findingType: input.finding.findingType,
    title: input.finding.recommendation.title,
    summary: input.finding.recommendation.summary,
    suggestedActions: input.finding.recommendation.suggestedActions,
    suggestedInterventions: input.finding.recommendation.suggestedInterventions ?? [],
    suggestedCurriculumImprovements: input.finding.recommendation.suggestedCurriculumImprovements ?? [],
    approvalRequired: true,
    forbiddenExecution: true,
    lineage: {
      workflowRunId: input.workflowRunId,
      agentRunId: input.agentRunId ?? null,
      traceId: input.traceId ?? null,
      isReplay: input.isReplay === true,
    },
  };
}

export async function createDetectorRecommendations(inputs: RecommendationRecordInput[]) {
  if (!isDetectorRecommendationGenerationEnabled()) {
    return { created: [], skipped: inputs.map((input) => ({ input, reason: "feature_flag_disabled" })) };
  }

  const created = [];
  for (const input of inputs) {
    const idempotencyKey = buildRecommendationIdempotencyKey({
      detectorId: input.detectorId,
      targetType: input.targetType,
      targetId: input.targetId,
      schoolId: input.schoolId,
      districtId: input.districtId,
      windowKey: input.windowKey,
      findingType: input.finding.findingType,
    });

    const decision = (await withDbWriteThrottle("autonomous.detector.recommendation", () =>
      (prisma as any).agentDecision.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          workflowRunId: input.workflowRunId,
          agentRunId: input.agentRunId ?? null,
          decisionType: `detector.recommendation.${input.detectorId}`,
          status: "proposed",
          riskLevel: input.finding.riskLevel,
          confidence: input.finding.confidence,
          requiresApproval: true,
          traceId: input.traceId ?? null,
          idempotencyKey,
          evidenceRefs: {
            refs: input.finding.evidence,
            signals: input.finding.signals.map((signal) => ({
              key: signal.key,
              value: signal.value,
              threshold: signal.threshold,
              direction: signal.direction,
              label: signal.label,
            })),
          },
          decision: buildRecommendationPayload(input),
          explanation: {
            deterministic: true,
            explanation: input.finding.explanation,
            confidence: input.finding.confidence,
            approvalRequired: true,
          },
        },
      })
    )) as any;
    created.push(decision);

    await Promise.all([
      logLearningEvent({
        workflowRunId: input.workflowRunId,
        workflowTraceId: input.traceId ?? null,
        schoolId: input.schoolId ?? null,
        districtId: input.districtId ?? null,
        actor: { type: "detector", id: input.detectorId },
        target: { type: "AgentDecision", id: decision.id },
        eventType: "action.proposed",
        source: "autonomous.detectors",
        status: "proposed",
        dedupeKey: idempotencyKey,
        isReplay: input.isReplay === true,
        metadata: {
          detectorId: input.detectorId,
          findingType: input.finding.findingType,
          confidence: input.finding.confidence,
          approvalRequired: true,
          recommendationOnly: true,
        },
      }),
      logAudit({
        action: "detector.recommendation.proposed",
        resourceType: "AgentDecision",
        resourceId: decision.id,
        traceId: input.traceId ?? null,
        schoolId: input.schoolId ?? null,
        details: {
          detectorId: input.detectorId,
          findingType: input.finding.findingType,
          confidence: input.finding.confidence,
          approvalRequired: true,
        },
      }),
    ]);
  }

  return { created, skipped: [] };
}
