import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { isDetectorExecutionEnabled } from "@/lib/serverFlags";
import { startWorkflow } from "@/lib/autonomous/workflowOrchestrator";
import { transitionWorkflowStatus } from "@/lib/autonomous/workflowStateManager";
import { toPrismaJson } from "@/lib/autonomous/idempotencyService";
import { getDetector, listDetectors } from "@/lib/autonomous/detectors/detectorRegistry";
import { resolveDetectorEvidence } from "@/lib/autonomous/detectors/detectorEvidenceResolver";
import { createDetectorRecommendations } from "@/lib/autonomous/detectors/detectorRecommendationEngine";
import { finishDetectorTrace, startDetectorTrace } from "@/lib/autonomous/detectors/detectorTraceService";
import type { DetectorContext, DetectorId, DetectorEvidence } from "@/lib/autonomous/detectors/types";

function detectorWorkflowKey(detectorId: DetectorId, context: DetectorContext, windowKey: string) {
  return createHash("sha256")
    .update(
      [
        "detector",
        detectorId,
        context.tenantId ?? context.schoolId ?? context.districtId ?? "national",
        context.targetType,
        context.targetId,
        windowKey,
        context.triggerEventId ?? "no-event",
        context.isReplay ? "replay" : "live",
      ].join("|")
    )
    .digest("hex");
}

async function recordWorkflowStep(input: {
  workflowRunId: string;
  stepKey: string;
  status: string;
  sequence: number;
  traceId?: string | null;
  inputRefs?: Record<string, unknown> | null;
  outputRefs?: Record<string, unknown> | null;
  executionMetadata?: Record<string, unknown> | null;
}) {
  const idempotencyKey = createHash("sha256")
    .update(`${input.workflowRunId}:${input.stepKey}:${input.sequence}`)
    .digest("hex");
  return withDbWriteThrottle("autonomous.detector.step", () =>
    (prisma as any).workflowStep.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workflowRunId: input.workflowRunId,
        stepKey: input.stepKey,
        status: input.status,
        sequence: input.sequence,
        idempotencyKey,
        traceId: input.traceId ?? null,
        startedAt: new Date(),
        completedAt: input.status === "succeeded" ? new Date() : null,
        inputRefs: toPrismaJson(input.inputRefs),
        outputRefs: toPrismaJson(input.outputRefs),
        executionMetadata: toPrismaJson(input.executionMetadata),
      },
    })
  );
}

async function createAgentRun(input: {
  workflowRunId: string;
  detectorId: DetectorId;
  context: DetectorContext;
  traceId?: string | null;
  idempotencyKey: string;
}) {
  return (await withDbWriteThrottle("autonomous.detector.agentRun", () =>
    (prisma as any).agentRun.upsert({
      where: { idempotencyKey: `${input.idempotencyKey}:agent` },
      update: {},
      create: {
        workflowRunId: input.workflowRunId,
        agentId: input.detectorId,
        tenantId: input.context.tenantId ?? null,
        schoolId: input.context.schoolId ?? null,
        status: "running",
        traceId: input.traceId ?? null,
        idempotencyKey: `${input.idempotencyKey}:agent`,
        riskLevel: "low",
        startedAt: new Date(),
        executionMetadata: {
          targetType: input.context.targetType,
          targetId: input.context.targetId,
          recommendationOnly: true,
        },
      },
    })
  )) as any;
}

async function finishAgentRun(input: {
  agentRunId: string;
  confidence: number;
  status: "succeeded" | "failed";
  evidence?: DetectorEvidence | null;
  outputRefs?: Record<string, unknown> | null;
  error?: unknown;
}) {
  return withDbWriteThrottle("autonomous.detector.agentRun.finish", () =>
    (prisma as any).agentRun.update({
      where: { id: input.agentRunId },
      data: {
        status: input.status,
        confidence: input.confidence,
        completedAt: new Date(),
        evidenceRefs: input.evidence ? { summary: input.evidence.summary, signals: input.evidence.signals.map((s) => s.key) } : undefined,
        outputRefs: toPrismaJson(input.outputRefs),
        lastErrorCode: input.error ? "detector_execution_failed" : null,
        lastErrorMessage: input.error instanceof Error ? input.error.message.slice(0, 500) : input.error ? String(input.error).slice(0, 500) : null,
      },
    })
  );
}

export async function executeDetector(detectorId: DetectorId, context: DetectorContext) {
  if (!isDetectorExecutionEnabled()) {
    return { skipped: true, reason: "feature_flag_disabled", detectorId };
  }

  const detector = getDetector(detectorId);
  const windowKey = context.windowKey ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = detectorWorkflowKey(detectorId, context, windowKey);
  const workflow = await startWorkflow({
    workflowType: `detector.${detectorId}`,
    tenantId: context.tenantId ?? context.schoolId ?? null,
    schoolId: context.schoolId ?? null,
    districtId: context.districtId ?? null,
    userId: context.actorId ?? null,
    source: "autonomous.detectors",
    targetType: context.targetType,
    targetId: context.targetId,
    triggerEventId: context.triggerEventId ?? null,
    riskLevel: detector.riskCeiling === "high" ? "medium" : "low",
    approvalRequired: false,
    idempotencyKey,
    evidenceRefs: { detectorId, windowKey },
    replayOfRunId: context.replayOfRunId ?? null,
    replayMode: "recommendation_only",
    isReplay: context.isReplay === true,
  });

  const run = workflow.workflowRun as any;
  if (!workflow.created) return { skipped: true, reason: "duplicate_workflow", detectorId, workflowRun: run };

  const trace = (await startDetectorTrace({
    traceId: run.traceId,
    workflowRunId: run.id,
    detectorId,
    tenantId: context.tenantId ?? null,
    schoolId: context.schoolId ?? null,
    actorId: context.actorId ?? null,
  })) as any;
  const agentRun = await createAgentRun({ workflowRunId: run.id, detectorId, context, traceId: run.traceId, idempotencyKey });

  try {
    await transitionWorkflowStatus({ workflowRunId: run.id, status: "running" });
    await recordWorkflowStep({
      workflowRunId: run.id,
      stepKey: "evidence_resolved",
      status: "succeeded",
      sequence: 1,
      traceId: run.traceId,
      inputRefs: { targetType: context.targetType, targetId: context.targetId },
    });
    const evidence = await resolveDetectorEvidence({ ...context, windowKey });
    const findings = detector.detect(evidence);
    await recordWorkflowStep({
      workflowRunId: run.id,
      stepKey: "deterministic_detection",
      status: "succeeded",
      sequence: 2,
      traceId: run.traceId,
      outputRefs: { findingCount: findings.length, detectorId },
      executionMetadata: { deterministic: true, llmPrimaryClassification: false },
    });

    const recommendationResult = await createDetectorRecommendations(
      findings.map((finding) => ({
        workflowRunId: run.id,
        agentRunId: agentRun.id,
        detectorId,
        traceId: run.traceId,
        tenantId: context.tenantId ?? null,
        schoolId: context.schoolId ?? null,
        districtId: context.districtId ?? null,
        targetType: context.targetType,
        targetId: context.targetId,
        windowKey,
        finding,
        isReplay: context.isReplay === true,
      }))
    );

    await recordWorkflowStep({
      workflowRunId: run.id,
      stepKey: "recommendations_proposed",
      status: "succeeded",
      sequence: 3,
      traceId: run.traceId,
      outputRefs: { recommendationCount: recommendationResult.created.length },
      executionMetadata: { approvalRequired: true, recommendationOnly: true },
    });

    const maxConfidence = Math.max(0, ...findings.map((finding) => finding.confidence));
    await finishAgentRun({
      agentRunId: agentRun.id,
      confidence: maxConfidence,
      status: "succeeded",
      evidence,
      outputRefs: { findingCount: findings.length, recommendationCount: recommendationResult.created.length },
    });
    await finishDetectorTrace({
      traceRecordId: trace?.id,
      traceId: run.traceId,
      workflowRunId: run.id,
      detectorId,
      schoolId: context.schoolId ?? null,
      findings,
      status: "succeeded",
    });
    await transitionWorkflowStatus({ workflowRunId: run.id, status: "succeeded" });
    return { skipped: false, detectorId, workflowRun: run, findings, recommendations: recommendationResult.created };
  } catch (error) {
    await finishAgentRun({ agentRunId: agentRun.id, confidence: 0, status: "failed", error });
    await finishDetectorTrace({
      traceRecordId: trace?.id,
      traceId: run.traceId,
      workflowRunId: run.id,
      detectorId,
      schoolId: context.schoolId ?? null,
      findings: [],
      status: "failed",
      error,
    });
    await transitionWorkflowStatus({ workflowRunId: run.id, status: "failed", error });
    throw error;
  }
}

export async function executeEligibleDetectors(context: DetectorContext) {
  const detectors = listDetectors().filter((detector) => {
    if (context.targetType === "national_aggregate") return detector.allowedTenantScopes.includes("national_aggregate");
    if (context.districtId && !context.schoolId) return detector.allowedTenantScopes.includes("district");
    return detector.allowedTenantScopes.includes("school");
  });
  const results = [];
  for (const detector of detectors) {
    results.push(await executeDetector(detector.id, context));
  }
  return results;
}
