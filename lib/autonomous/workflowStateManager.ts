import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import {
  ACTIVE_WORKFLOW_STATUSES,
  type JsonObject,
  type WorkflowReplayMode,
  type WorkflowRiskLevel,
  type WorkflowStatus,
} from "@/lib/autonomous/types";
import { createExecutionCorrelation } from "@/lib/autonomous/executionCorrelationService";
import {
  buildStepIdempotencyKey,
  buildWorkflowIdempotencyKey,
  findExistingWorkflowRun,
  toPrismaJson,
} from "@/lib/autonomous/idempotencyService";

export type CreateWorkflowRunInput = {
  workflowType: string;
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  userId?: string | null;
  source?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  triggerEventId?: string | null;
  riskLevel?: WorkflowRiskLevel;
  approvalRequired?: boolean;
  idempotencyKey?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  evidenceRefs?: JsonObject | null;
  queueMetadata?: JsonObject | null;
  executionMetadata?: JsonObject | null;
  replayOfRunId?: string | null;
  replayMode?: WorkflowReplayMode;
  replaySequence?: number | null;
  isReplay?: boolean;
  maxAttempts?: number;
};

export type RecordCheckpointInput = {
  workflowRunId: string;
  checkpointKey: string;
  status?: string;
  actorType?: string | null;
  actorId?: string | null;
  workerId?: string | null;
  traceId?: string | null;
  idempotencyKey?: string | null;
  state?: JsonObject | null;
  evidenceRefs?: JsonObject | null;
  executionMetadata?: JsonObject | null;
};

function truncateError(value: unknown) {
  return value instanceof Error ? value.message.slice(0, 1000) : String(value ?? "").slice(0, 1000);
}

function terminalTimestamp(status: WorkflowStatus) {
  const now = new Date();
  if (status === "succeeded") return { completedAt: now };
  if (status === "cancelled") return { cancelledAt: now };
  if (status === "dead_lettered") return { deadLetteredAt: now };
  return {};
}

export async function createWorkflowRun(input: CreateWorkflowRunInput) {
  const correlation = createExecutionCorrelation(input);
  const idempotencyKey =
    input.idempotencyKey ??
    buildWorkflowIdempotencyKey({
      workflowType: input.workflowType,
      partitionKey: correlation.partitionKey,
      targetType: input.targetType,
      targetId: input.targetId,
      triggerEventId: input.triggerEventId,
    });
  const existing = await findExistingWorkflowRun(idempotencyKey);
  if (existing) return { workflowRun: existing, created: false };

  const activeCount = await ((prisma as any).workflowRun?.count?.({
    where: {
      partitionKey: correlation.partitionKey,
      workflowType: input.workflowType,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      status: { in: ACTIVE_WORKFLOW_STATUSES },
    },
  }) ?? Promise.resolve(0));
  if (activeCount > 0) {
    throw Object.assign(new Error("Active workflow already exists for partition and target"), {
      code: "workflow_concurrency_conflict",
      status: 409,
    });
  }

  const workflowRun = (await withDbWriteThrottle("autonomous.workflow.create", () =>
    (prisma as any).workflowRun.create({
      data: {
        workflowType: input.workflowType,
        tenantId: input.tenantId ?? null,
        schoolId: input.schoolId ?? null,
        districtId: input.districtId ?? null,
        partitionKey: correlation.partitionKey,
        status: input.approvalRequired ? "waiting_for_approval" : "pending",
        riskLevel: input.riskLevel ?? "low",
        traceId: correlation.traceId,
        correlationId: correlation.correlationId,
        idempotencyKey,
        triggerEventId: input.triggerEventId ?? null,
        replayOfRunId: input.replayOfRunId ?? null,
        isReplay: input.isReplay === true,
        replayMode: input.replayMode ?? "analysis_only",
        replaySequence: input.replaySequence ?? null,
        source: input.source ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        approvalRequired: input.approvalRequired === true,
        attempt: 0,
        maxAttempts: input.maxAttempts ?? 3,
        evidenceRefs: toPrismaJson(input.evidenceRefs),
        queueMetadata: toPrismaJson(input.queueMetadata),
        executionMetadata: toPrismaJson(input.executionMetadata),
        tracingMetadata: toPrismaJson({
          createdBy: "workflowStateManager",
          queueSafe: true,
          ...((input.executionMetadata?.tracingMetadata as JsonObject | undefined) ?? {}),
        }),
      },
    })
  )) as any;

  await Promise.all([
    recordWorkflowCheckpoint({
      workflowRunId: workflowRun.id,
      checkpointKey: "trigger_received",
      traceId: workflowRun.traceId,
      actorType: "system",
      actorId: "workflowStateManager",
      evidenceRefs: input.evidenceRefs,
      executionMetadata: { status: workflowRun.status },
    }),
    logLearningEvent({
      workflowRunId: workflowRun.id,
      workflowTraceId: workflowRun.traceId,
      correlationId: workflowRun.correlationId,
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      actor: { type: "system", id: "workflowStateManager" },
      target: { type: input.targetType ?? "workflow", id: input.targetId ?? workflowRun.id },
      eventType: "workflow.started",
      source: input.source ?? "autonomous.workflow",
      status: workflowRun.status,
      dedupeKey: idempotencyKey,
      replayOfEventId: input.triggerEventId ?? null,
      isReplay: input.isReplay === true,
      metadata: {
        workflowType: input.workflowType,
        riskLevel: workflowRun.riskLevel,
        partitionKey: workflowRun.partitionKey,
        approvalRequired: workflowRun.approvalRequired,
      },
    }),
    logAudit({
      action: "workflow.started",
      resourceType: "WorkflowRun",
      resourceId: workflowRun.id,
      traceId: workflowRun.traceId,
      schoolId: input.schoolId ?? null,
      details: {
        workflowType: input.workflowType,
        riskLevel: workflowRun.riskLevel,
        status: workflowRun.status,
      },
    }),
  ]);

  return { workflowRun, created: true };
}

export async function recordWorkflowCheckpoint(input: RecordCheckpointInput) {
  const count = await ((prisma as any).workflowCheckpoint?.count?.({
    where: { workflowRunId: input.workflowRunId },
  }) ?? Promise.resolve(0));
  const sequence = count + 1;
  const idempotencyKey =
    input.idempotencyKey ??
    buildStepIdempotencyKey({
      workflowRunId: input.workflowRunId,
      stepKey: input.checkpointKey,
      sequence,
    });

  const checkpoint = (await withDbWriteThrottle("autonomous.workflow.checkpoint", () =>
    (prisma as any).workflowCheckpoint.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workflowRunId: input.workflowRunId,
        checkpointKey: input.checkpointKey,
        status: input.status ?? "recorded",
        sequence,
        actorType: input.actorType ?? null,
        actorId: input.actorId ?? null,
        workerId: input.workerId ?? null,
        traceId: input.traceId ?? null,
        idempotencyKey,
        state: toPrismaJson(input.state),
        evidenceRefs: toPrismaJson(input.evidenceRefs),
        executionMetadata: toPrismaJson(input.executionMetadata),
      },
    })
  )) as any;

  await (prisma as any).workflowRun?.update?.({
    where: { id: input.workflowRunId },
    data: { currentCheckpoint: input.checkpointKey, version: { increment: 1 } },
  });

  await logLearningEvent({
    workflowRunId: input.workflowRunId,
    workflowTraceId: input.traceId ?? null,
    correlationId: input.state?.correlationId as string | undefined,
    actor: { type: input.actorType ?? "system", id: input.actorId ?? "workflowStateManager" },
    target: { type: "WorkflowCheckpoint", id: checkpoint.id },
    eventType: "workflow.checkpointed",
    source: "autonomous.workflow",
    status: input.status ?? "recorded",
    dedupeKey: idempotencyKey,
    metadata: { checkpointKey: input.checkpointKey, sequence },
  });

  return checkpoint;
}

export async function transitionWorkflowStatus(input: {
  workflowRunId: string;
  status: WorkflowStatus;
  workerId?: string | null;
  errorCode?: string | null;
  error?: unknown;
  nextRetryAt?: Date | null;
  executionMetadata?: JsonObject | null;
}) {
  const data: JsonObject = {
    status: input.status,
    nextRetryAt: input.nextRetryAt ?? null,
    lastErrorCode: input.errorCode ?? null,
    lastErrorMessage: input.error ? truncateError(input.error) : null,
    executionMetadata: input.executionMetadata ?? undefined,
    version: { increment: 1 },
    ...terminalTimestamp(input.status),
  };
  if (input.status === "running" || input.status === "executing") {
    data.startedAt = new Date();
  }

  const workflowRun = (await withDbWriteThrottle("autonomous.workflow.transition", () =>
    (prisma as any).workflowRun.update({
      where: { id: input.workflowRunId },
      data,
    })
  )) as any;

  await recordWorkflowCheckpoint({
    workflowRunId: input.workflowRunId,
    checkpointKey: input.status,
    status: "recorded",
    workerId: input.workerId ?? null,
    traceId: workflowRun.traceId,
    executionMetadata: input.executionMetadata ?? null,
  });

  return workflowRun;
}

export async function acquireWorkflowRun(input: {
  workflowRunId: string;
  workerId: string;
  lockMs?: number;
}) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + (input.lockMs ?? 60_000));
  const result = await (prisma as any).workflowRun.updateMany({
    where: {
      id: input.workflowRunId,
      status: { in: ["pending", "eligible", "running", "approved", "executing", "failed"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }, { lockedBy: input.workerId }],
    },
    data: {
      lockedBy: input.workerId,
      lockedUntil,
      attempt: { increment: 1 },
      status: "running",
      version: { increment: 1 },
    },
  });

  if (result.count !== 1) {
    throw Object.assign(new Error("Workflow lock unavailable"), {
      code: "workflow_lock_unavailable",
      status: 409,
    });
  }

  return (prisma as any).workflowRun.findUnique({ where: { id: input.workflowRunId } });
}

export async function releaseWorkflowRun(input: { workflowRunId: string; workerId?: string | null }) {
  return (prisma as any).workflowRun.updateMany({
    where: {
      id: input.workflowRunId,
      ...(input.workerId ? { lockedBy: input.workerId } : {}),
    },
    data: { lockedBy: null, lockedUntil: null },
  });
}

export async function markWorkflowFailure(input: {
  workflowRunId: string;
  error: unknown;
  errorCode?: string;
  retryable?: boolean;
  retryDelayMs?: number;
}) {
  const run = await (prisma as any).workflowRun.findUnique({ where: { id: input.workflowRunId } });
  const retryable = input.retryable !== false && (run?.attempt ?? 0) < (run?.maxAttempts ?? 3);
  return transitionWorkflowStatus({
    workflowRunId: input.workflowRunId,
    status: retryable ? "failed" : "dead_lettered",
    errorCode: input.errorCode ?? (retryable ? "retryable_failure" : "dead_lettered"),
    error: input.error,
    nextRetryAt: retryable ? new Date(Date.now() + (input.retryDelayMs ?? 60_000)) : null,
  });
}

export async function cancelWorkflowRun(input: {
  workflowRunId: string;
  cancelledByUserId?: string | null;
  reason?: string | null;
}) {
  const workflowRun = (await transitionWorkflowStatus({
    workflowRunId: input.workflowRunId,
    status: "cancelled",
    executionMetadata: { reason: input.reason ?? null },
  })) as any;
  await logAudit({
    userId: input.cancelledByUserId ?? null,
    action: "workflow.cancelled",
    resourceType: "WorkflowRun",
    resourceId: input.workflowRunId,
    traceId: workflowRun.traceId,
    schoolId: workflowRun.schoolId,
    details: { reason: input.reason ?? null },
  });
  return workflowRun;
}

export async function createApprovalRequest(input: {
  workflowRunId: string;
  approvalType: string;
  riskLevel: WorkflowRiskLevel;
  approverRole?: string | null;
  requestedByType?: string | null;
  requestedById?: string | null;
  evidenceRefs?: JsonObject | null;
  requestPayload?: JsonObject | null;
  expiresAt?: Date | null;
}) {
  const run = await (prisma as any).workflowRun.findUnique({ where: { id: input.workflowRunId } });
  if (!run) throw Object.assign(new Error("WorkflowRun not found"), { status: 404 });
  const idempotencyKey = buildStepIdempotencyKey({
    workflowRunId: input.workflowRunId,
    stepKey: `approval:${input.approvalType}`,
    sequence: 0,
  });

  const approval = (await withDbWriteThrottle("autonomous.workflow.approval", () =>
    (prisma as any).approvalRequest.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        workflowRunId: input.workflowRunId,
        status: "pending",
        riskLevel: input.riskLevel,
        approvalType: input.approvalType,
        tenantId: run.tenantId,
        schoolId: run.schoolId,
        districtId: run.districtId,
        requestedByType: input.requestedByType ?? "system",
        requestedById: input.requestedById ?? null,
        approverRole: input.approverRole ?? null,
        traceId: run.traceId,
        idempotencyKey,
        evidenceRefs: toPrismaJson(input.evidenceRefs),
        requestPayload: toPrismaJson(input.requestPayload),
        expiresAt: input.expiresAt ?? null,
      },
    })
  )) as any;

  await (prisma as any).workflowRun.update({
    where: { id: input.workflowRunId },
    data: {
      status: "waiting_for_approval",
      approvalRequired: true,
      approvalRequestId: approval.id,
      version: { increment: 1 },
    },
  });
  await recordWorkflowCheckpoint({
    workflowRunId: input.workflowRunId,
    checkpointKey: "approval_requested",
    traceId: run.traceId,
    evidenceRefs: input.evidenceRefs,
    executionMetadata: { approvalRequestId: approval.id, approvalType: input.approvalType },
  });
  return approval;
}
