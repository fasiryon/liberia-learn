import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { startExecutionTrace, finishExecutionTrace } from "@/lib/autonomous/executionTraceService";
import { recordWorkflowCheckpoint } from "@/lib/autonomous/workflowStateManager";
import type { DetectionFinding, DetectorId } from "@/lib/autonomous/detectors/types";

export async function startDetectorTrace(input: {
  traceId: string;
  workflowRunId: string;
  detectorId: DetectorId;
  tenantId?: string | null;
  schoolId?: string | null;
  actorId?: string | null;
}) {
  await recordWorkflowCheckpoint({
    workflowRunId: input.workflowRunId,
    checkpointKey: `detector:${input.detectorId}:started`,
    traceId: input.traceId,
    actorType: "detector",
    actorId: input.detectorId,
  });
  return startExecutionTrace({
    traceId: input.traceId,
    workflowRunId: input.workflowRunId,
    spanType: "detector",
    spanName: input.detectorId,
    tenantId: input.tenantId ?? null,
    schoolId: input.schoolId ?? null,
    actorType: "detector",
    actorId: input.detectorId,
  });
}

export async function finishDetectorTrace(input: {
  traceRecordId?: string | null;
  traceId: string;
  workflowRunId: string;
  detectorId: DetectorId;
  schoolId?: string | null;
  findings: DetectionFinding[];
  status?: "succeeded" | "failed";
  error?: unknown;
}) {
  if (input.traceRecordId) {
    await finishExecutionTrace({
      id: input.traceRecordId,
      status: input.status ?? "succeeded",
      errorCode: input.error ? "detector_execution_failed" : null,
      errorMessage: input.error instanceof Error ? input.error.message.slice(0, 500) : input.error ? String(input.error).slice(0, 500) : null,
      metadata: {
        detectorId: input.detectorId,
        findingCount: input.findings.length,
        maxConfidence: Math.max(0, ...input.findings.map((finding) => finding.confidence)),
      },
    });
  }

  await recordWorkflowCheckpoint({
    workflowRunId: input.workflowRunId,
    checkpointKey: `detector:${input.detectorId}:${input.status ?? "succeeded"}`,
    traceId: input.traceId,
    actorType: "detector",
    actorId: input.detectorId,
    executionMetadata: {
      findingCount: input.findings.length,
      error: input.error instanceof Error ? input.error.message : input.error ? String(input.error) : null,
    },
  });

  await Promise.all([
    logLearningEvent({
      workflowRunId: input.workflowRunId,
      workflowTraceId: input.traceId,
      schoolId: input.schoolId ?? null,
      actor: { type: "detector", id: input.detectorId },
      target: { type: "workflow", id: input.workflowRunId },
      eventType: "agent.detected",
      source: "autonomous.detectors",
      status: input.status ?? "succeeded",
      metadata: {
        detectorId: input.detectorId,
        findingCount: input.findings.length,
        recommendationOnly: true,
      },
    }),
    logAudit({
      action: "detector.executed",
      resourceType: "WorkflowRun",
      resourceId: input.workflowRunId,
      traceId: input.traceId,
      schoolId: input.schoolId ?? null,
      details: {
        detectorId: input.detectorId,
        findingCount: input.findings.length,
        recommendationOnly: true,
      },
    }),
  ]);
}
