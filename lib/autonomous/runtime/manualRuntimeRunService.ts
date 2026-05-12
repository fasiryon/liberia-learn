import { readFile } from "fs/promises";
import path from "path";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { processStaleApprovals } from "@/lib/autonomous/actions/staleApprovalWorker";
import { processDueEvaluationWindows } from "@/lib/autonomous/optimization/evaluationWindowScheduler";
import { logAutonomousCronRun } from "@/lib/autonomous/runtime/autonomousCronLog";
import { runDeadLetterInspection } from "@/lib/autonomous/runtime/deadLetterInspectionService";
import { getRuntimeHealthSummary } from "@/lib/autonomous/runtime/runtimeHealthService";
import { runWorkflowRecovery } from "@/lib/autonomous/runtime/workflowRecoveryService";
import type { AutonomousCronPipeline, CronRunStatus } from "@/lib/autonomous/runtime/types";
import {
  isApprovalExpirationWorkerEnabled,
  isAutonomousEmergencyShutdownEnabled,
  isDeadLetterInspectionCronEnabled,
  isImplementationWorkflowEnabled,
  isRuntimeHealthCronEnabled,
  isWorkflowRecoveryCronEnabled,
} from "@/lib/serverFlags";

export type ManualRuntimeRunKind =
  | "stale-approvals"
  | "evaluation-windows"
  | "workflow-recovery"
  | "runtime-health"
  | "dead-letter-inspection";

export type ManualRuntimeRunResult = {
  ok: boolean;
  kind: ManualRuntimeRunKind | "full-maintenance";
  pipeline?: AutonomousCronPipeline;
  status: CronRunStatus;
  skipped: boolean;
  reason: string | null;
  durationMs: number;
  processed: number;
  failed: number;
  result: Record<string, unknown>;
  idempotencyKey: string | null;
  reused: boolean;
  ranAt: string;
};

export type ManualRuntimeRunHistoryRow = {
  id: string;
  action: string;
  pipeline: string;
  kind: string;
  ranAt: string;
  status: string;
  skipped: boolean;
  reason: string | null;
  processed: number;
  failed: number;
  durationMs: number;
  actor: { id: string | null; name: string | null };
  resultSummary: string;
};

export type ManualRuntimeRunDetail = ManualRuntimeRunHistoryRow & {
  auditLog: {
    id: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    createdAt: string;
    traceId: string | null;
  };
  dryRun: boolean;
  failedCount: number;
  processedCount: number;
  skippedCount: number;
  result: Record<string, unknown>;
  linkedAuditLogs: Array<{
    id: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    createdAt: string;
  }>;
  linkedExecutionTraces: Array<{
    id: string;
    traceId: string;
    workflowRunId: string | null;
    spanType: string;
    spanName: string;
    status: string;
    startedAt: string;
  }>;
  links: {
    workflows: Array<{ id: string; href: string }>;
    approvals: Array<{ id: string; href: string }>;
    evaluations: Array<{ id: string; href: string }>;
    deadLetters: Array<{ id: string; href: string }>;
    replayConsoles: Array<{ id: string; href: string }>;
  };
};

const RUN_CONFIG: Record<
  ManualRuntimeRunKind,
  {
    pipeline: AutonomousCronPipeline;
    flagDisabledReason: string;
    enabled: () => boolean;
    mutates: boolean;
  }
> = {
  "stale-approvals": {
    pipeline: "autonomous.stale_approvals",
    flagDisabledReason: "approval_expiration_worker_disabled",
    enabled: isApprovalExpirationWorkerEnabled,
    mutates: true,
  },
  "evaluation-windows": {
    pipeline: "autonomous.evaluation_windows",
    flagDisabledReason: "implementation_workflow_disabled",
    enabled: isImplementationWorkflowEnabled,
    mutates: true,
  },
  "workflow-recovery": {
    pipeline: "autonomous.workflow_recovery",
    flagDisabledReason: "workflow_recovery_cron_disabled",
    enabled: isWorkflowRecoveryCronEnabled,
    mutates: true,
  },
  "runtime-health": {
    pipeline: "autonomous.runtime_health",
    flagDisabledReason: "runtime_health_cron_disabled",
    enabled: isRuntimeHealthCronEnabled,
    mutates: false,
  },
  "dead-letter-inspection": {
    pipeline: "autonomous.dead_letter_inspection",
    flagDisabledReason: "dead_letter_inspection_cron_disabled",
    enabled: isDeadLetterInspectionCronEnabled,
    mutates: true,
  },
};

function sanitizeIdempotencyKey(key?: unknown): string | null {
  if (typeof key !== "string") return null;
  const clean = key.trim().replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 160);
  return clean || null;
}

function manualActionFor(pipeline: AutonomousCronPipeline) {
  return `manual.cron.${pipeline}.run`;
}

function resultFromAuditDetails(
  kind: ManualRuntimeRunKind,
  pipeline: AutonomousCronPipeline,
  idempotencyKey: string,
  details: Record<string, unknown>
): ManualRuntimeRunResult {
  return {
    ok: true,
    kind,
    pipeline,
    status: (details.status as CronRunStatus) ?? "ok",
    skipped: Boolean(details.skipped),
    reason: (details.reason as string | null) ?? null,
    durationMs: Number(details.durationMs ?? 0),
    processed: Number(details.processed ?? 0),
    failed: Number(details.failed ?? 0),
    result: (details.result as Record<string, unknown>) ?? {},
    idempotencyKey,
    reused: true,
    ranAt: String(details.ranAt ?? new Date().toISOString()),
  };
}

async function findPriorManualRun(
  kind: ManualRuntimeRunKind,
  pipeline: AutonomousCronPipeline,
  idempotencyKey: string | null
): Promise<ManualRuntimeRunResult | null> {
  if (!idempotencyKey) return null;
  const row = await prisma.auditLog.findFirst({
    where: {
      action: manualActionFor(pipeline),
      resourceType: "autonomous_manual_run",
      resourceId: pipeline,
      details: { path: ["idempotencyKey"], equals: idempotencyKey },
    } as any,
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
  if (!row?.details) return null;
  return resultFromAuditDetails(kind, pipeline, idempotencyKey, row.details as Record<string, unknown>);
}

async function executeKind(kind: ManualRuntimeRunKind, actorId: string, dryRun: boolean) {
  if (kind === "stale-approvals") return processStaleApprovals({ dryRun });
  if (kind === "evaluation-windows") {
    const results = await processDueEvaluationWindows({ actorId, limit: 10 });
    const closed = results.filter((r) => r.status === "closed").length;
    return { total: results.length, closed, results };
  }
  if (kind === "workflow-recovery") return runWorkflowRecovery({ dryRun });
  if (kind === "runtime-health") {
    const health = await getRuntimeHealthSummary();
    await logAudit({
      userId: actorId,
      action: "autonomous.runtime.health.snapshot",
      resourceType: "autonomous_runtime",
      resourceId: "runtime_health",
      details: {
        status: health.status,
        signals: health.signals,
        stuckWorkflows: health.stuckWorkflows,
        deadLetterCount: health.deadLetterCount,
        activeExecutions: health.activeExecutions,
        backpressureActive: health.backpressureActive,
        timestamp: health.timestamp,
        source: "manual_runtime_control",
      },
    });
    return { health };
  }
  return runDeadLetterInspection({ actorId, dryRun });
}

function summarizeRun(kind: ManualRuntimeRunKind, result: Record<string, unknown>) {
  if (kind === "stale-approvals") {
    return { processed: Number(result.expired ?? 0) + Number(result.escalated ?? 0), failed: 0 };
  }
  if (kind === "evaluation-windows") return { processed: Number(result.closed ?? 0), failed: 0 };
  if (kind === "workflow-recovery") {
    return {
      processed: Number(result.recovered ?? 0) + Number(result.requeued ?? 0),
      failed: Number(result.quarantined ?? 0),
    };
  }
  if (kind === "runtime-health") return { processed: 1, failed: 0 };
  return { processed: Number(result.inspected ?? 0), failed: 0 };
}

export async function runManualRuntimeJob(input: {
  kind: ManualRuntimeRunKind;
  actorId: string;
  idempotencyKey?: unknown;
  dryRun?: boolean;
}): Promise<ManualRuntimeRunResult> {
  const config = RUN_CONFIG[input.kind];
  const idempotencyKey = sanitizeIdempotencyKey(input.idempotencyKey);
  const prior = await findPriorManualRun(input.kind, config.pipeline, idempotencyKey);
  if (prior) return prior;

  const start = Date.now();
  const ranAt = new Date().toISOString();
  let status: CronRunStatus = "ok";
  let skipped = false;
  let reason: string | null = null;
  let result: Record<string, unknown> = {};

  try {
    if (!config.enabled()) {
      status = "skipped";
      skipped = true;
      reason = config.flagDisabledReason;
    } else if (config.mutates && isAutonomousEmergencyShutdownEnabled()) {
      status = "skipped";
      skipped = true;
      reason = "emergency_shutdown";
    } else {
      result = (await executeKind(input.kind, input.actorId, input.dryRun === true)) as Record<string, unknown>;
    }

    const durationMs = Date.now() - start;
    const summary = skipped ? { processed: 0, failed: 0 } : summarizeRun(input.kind, result);

    await logAutonomousCronRun({
      pipeline: config.pipeline,
      status,
      processed: summary.processed,
      failed: summary.failed,
      durationMs,
      error: reason,
    });

    await logAudit({
      userId: input.actorId,
      action: manualActionFor(config.pipeline),
      resourceType: "autonomous_manual_run",
      resourceId: config.pipeline,
      details: {
        source: "admin_manual_runtime_control",
        kind: input.kind,
        pipeline: config.pipeline,
        status,
        skipped,
        reason,
        processed: summary.processed,
        failed: summary.failed,
        durationMs,
        dryRun: input.dryRun === true,
        idempotencyKey,
        ranAt,
        result,
      },
    });

    return {
      ok: true,
      kind: input.kind,
      pipeline: config.pipeline,
      status,
      skipped,
      reason,
      durationMs,
      processed: summary.processed,
      failed: summary.failed,
      result,
      idempotencyKey,
      reused: false,
      ranAt,
    };
  } catch (error: any) {
    const durationMs = Date.now() - start;
    await logAutonomousCronRun({
      pipeline: config.pipeline,
      status: "error",
      processed: 0,
      failed: 1,
      durationMs,
      error: error?.message ?? "Unknown error",
    }).catch(() => {});
    await logAudit({
      userId: input.actorId,
      action: manualActionFor(config.pipeline),
      resourceType: "autonomous_manual_run",
      resourceId: config.pipeline,
      details: {
        source: "admin_manual_runtime_control",
        kind: input.kind,
        pipeline: config.pipeline,
        status: "error",
        skipped: false,
        reason: null,
        processed: 0,
        failed: 1,
        durationMs,
        dryRun: input.dryRun === true,
        idempotencyKey,
        ranAt,
        error: error?.message ?? "Unknown error",
      },
    });
    throw error;
  }
}

export async function runManualFullRuntimeMaintenance(input: {
  actorId: string;
  idempotencyKey?: unknown;
  dryRun?: boolean;
}) {
  const baseKey = sanitizeIdempotencyKey(input.idempotencyKey);
  const runs = [];
  for (const kind of Object.keys(RUN_CONFIG) as ManualRuntimeRunKind[]) {
    runs.push(
      await runManualRuntimeJob({
        kind,
        actorId: input.actorId,
        dryRun: input.dryRun,
        idempotencyKey: baseKey ? `${baseKey}:${kind}` : null,
      })
    );
  }
  return {
    ok: true,
    kind: "full-maintenance" as const,
    status: runs.some((run) => run.status === "error") ? "error" : "ok",
    skipped: runs.every((run) => run.skipped),
    reason: null,
    durationMs: runs.reduce((sum, run) => sum + run.durationMs, 0),
    processed: runs.reduce((sum, run) => sum + run.processed, 0),
    failed: runs.reduce((sum, run) => sum + run.failed, 0),
    result: { runs },
    idempotencyKey: baseKey,
    reused: runs.every((run) => run.reused),
    ranAt: new Date().toISOString(),
  };
}

function resultSummary(details: Record<string, unknown>) {
  const result = (details.result ?? {}) as Record<string, unknown>;
  const health = (result.health ?? {}) as Record<string, unknown>;
  if (health.status) return `runtime ${String(health.status)}`;
  if (Array.isArray(result.runs)) return `${result.runs.length} maintenance jobs`;
  const processed = Number(details.processed ?? 0);
  const failed = Number(details.failed ?? 0);
  const skipped = Boolean(details.skipped);
  if (skipped) return `skipped: ${String(details.reason ?? "not available")}`;
  return `processed ${processed}, failed ${failed}`;
}

function manualRunRow(row: {
  id: string;
  createdAt: Date;
  action: string;
  resourceId: string | null;
  details: unknown;
  user?: { id: string; name: string | null } | null;
}): ManualRuntimeRunHistoryRow {
  const d = (row.details ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    action: row.action,
    pipeline: String(row.resourceId ?? d.pipeline ?? "unknown"),
    kind: String(d.kind ?? "unknown"),
    ranAt: String(d.ranAt ?? row.createdAt.toISOString()),
    status: String(d.status ?? "unknown"),
    skipped: Boolean(d.skipped),
    reason: (d.reason as string | null) ?? null,
    processed: Number(d.processed ?? 0),
    failed: Number(d.failed ?? 0),
    durationMs: Number(d.durationMs ?? 0),
    actor: { id: row.user?.id ?? null, name: row.user?.name ?? null },
    resultSummary: resultSummary(d),
  };
}

function collectStringIds(value: unknown, keyNames: Set<string>, output = new Set<string>()) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectStringIds(item, keyNames, output);
    return output;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keyNames.has(key) && typeof child === "string" && child.trim()) output.add(child);
    collectStringIds(child, keyNames, output);
  }
  return output;
}

function hrefs(ids: Set<string>, path: (id: string) => string) {
  return [...ids].slice(0, 25).map((id) => ({ id, href: path(id) }));
}

export async function getManualRuntimeRunHistory(limit = 20): Promise<ManualRuntimeRunHistoryRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: { resourceType: "autonomous_manual_run" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      action: true,
      resourceId: true,
      details: true,
      user: { select: { id: true, name: true } },
    },
  });
  return rows.map(manualRunRow);
}

export async function getManualRuntimeRunDetail(runId: string): Promise<ManualRuntimeRunDetail | null> {
  const row = await prisma.auditLog.findFirst({
    where: { id: runId, resourceType: "autonomous_manual_run" },
    select: {
      id: true,
      createdAt: true,
      action: true,
      resourceType: true,
      resourceId: true,
      details: true,
      traceId: true,
      user: { select: { id: true, name: true } },
    },
  });
  if (!row) return null;

  const details = (row.details ?? {}) as Record<string, unknown>;
  const base = manualRunRow(row);
  const workflowIds = collectStringIds(details, new Set(["workflowRunId", "workflowId", "newWorkflowRunId"]));
  const approvalIds = collectStringIds(details, new Set(["approvalRequestId", "approvalId"]));
  const evaluationIds = collectStringIds(details, new Set(["evaluationPlanId", "evaluationId", "postChangeEvaluationPlanId"]));
  const deadLetterIds = new Set(workflowIds);

  const traceWhere: any[] = [];
  if (row.traceId) traceWhere.push({ traceId: row.traceId });
  if (workflowIds.size > 0) traceWhere.push({ workflowRunId: { in: [...workflowIds] } });
  const [linkedAuditLogs, linkedExecutionTraces] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [
          { id: row.id },
          { action: `cron.${base.pipeline}.run`, resourceType: "autonomous_cron_run", resourceId: base.pipeline },
          ...(row.traceId ? [{ traceId: row.traceId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true },
    }),
    traceWhere.length
      ? prisma.executionTrace.findMany({
          where: { OR: traceWhere },
          orderBy: { startedAt: "asc" },
          take: 50,
          select: {
            id: true,
            traceId: true,
            workflowRunId: true,
            spanType: true,
            spanName: true,
            status: true,
            startedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    ...base,
    auditLog: {
      id: row.id,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      createdAt: row.createdAt.toISOString(),
      traceId: row.traceId,
    },
    dryRun: details.dryRun === true,
    failedCount: base.failed,
    processedCount: base.processed,
    skippedCount: base.skipped ? 1 : 0,
    result: (details.result as Record<string, unknown>) ?? {},
    linkedAuditLogs: linkedAuditLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    linkedExecutionTraces: linkedExecutionTraces.map((trace) => ({
      ...trace,
      startedAt: trace.startedAt.toISOString(),
    })),
    links: {
      workflows: hrefs(workflowIds, (id) => `/admin/ops/workflows/${id}`),
      approvals: hrefs(approvalIds, (id) => `/admin/ops/approvals/${id}`),
      evaluations: hrefs(evaluationIds, (id) => `/admin/ops/optimization/evaluation-windows?evaluationId=${encodeURIComponent(id)}`),
      deadLetters: hrefs(deadLetterIds, (id) => `/admin/ops/runtime/dead-letter/${id}`),
      replayConsoles: hrefs(workflowIds, (id) => `/admin/ops/workflows/${id}/replay`),
    },
  };
}

export async function getCronPauseStatus() {
  try {
    const raw = await readFile(path.join(process.cwd(), "vercel.json"), "utf8");
    const parsed = JSON.parse(raw);
    const crons = Array.isArray(parsed.crons) ? parsed.crons : [];
    return {
      paused: crons.length === 0,
      configuredCount: crons.length,
      restoreCount: Array.isArray(parsed._cronsPaused_restoreOnProUpgrade)
        ? parsed._cronsPaused_restoreOnProUpgrade.length
        : 0,
    };
  } catch {
    return { paused: false, configuredCount: null, restoreCount: null };
  }
}
