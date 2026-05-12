import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isWorkflowRecoveryCronEnabled } from "@/lib/serverFlags";
import {
  transitionWorkflowStatus,
  releaseWorkflowRun,
} from "@/lib/autonomous/workflowStateManager";
import { enqueueWorkflowRun } from "@/lib/autonomous/workflowOrchestrator";
import type { WorkflowRecoveryResult } from "@/lib/autonomous/runtime/types";

function numberFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function exponentialBackoffMs(attempt: number): number {
  const base = 60_000;
  const cap = 30 * 60_000;
  const jitter = Math.floor(Math.random() * 5_000);
  return Math.min(base * Math.pow(2, attempt), cap) + jitter;
}

export async function recoverStuckWorkflows(input: {
  limit?: number;
  actorId?: string | null;
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<WorkflowRecoveryResult> {
  if (!isWorkflowRecoveryCronEnabled()) {
    return { scanned: 0, recovered: 0, quarantined: 0, skipped: 0, details: [] };
  }

  const now = input.now ?? new Date();
  const stuckMinutes = numberFromEnv("AUTONOMOUS_STUCK_WORKFLOW_MINUTES", 45);
  const stuckSince = new Date(now.getTime() - stuckMinutes * 60_000);
  const limit = input.limit ?? 50;

  const stuckWorkflows = await (prisma as any).workflowRun.findMany({
    where: {
      status: { in: ["running", "executing"] },
      updatedAt: { lt: stuckSince },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: {
      id: true,
      workflowType: true,
      schoolId: true,
      attempt: true,
      maxAttempts: true,
      traceId: true,
      partitionKey: true,
      idempotencyKey: true,
      lockedBy: true,
      lockedUntil: true,
    },
  });

  const details: WorkflowRecoveryResult["details"] = [];
  let recovered = 0;
  let quarantined = 0;
  let skipped = 0;

  for (const run of stuckWorkflows) {
    const attempt = run.attempt ?? 0;
    const maxAttempts = run.maxAttempts ?? 3;
    const exhausted = attempt >= maxAttempts;

    if (input.dryRun) {
      details.push({
        workflowRunId: run.id,
        action: "skipped",
        reason: exhausted ? "dry_run_would_quarantine" : "dry_run_would_recover",
      });
      skipped++;
      continue;
    }

    try {
      await releaseWorkflowRun({ workflowRunId: run.id });

      if (exhausted) {
        await transitionWorkflowStatus({
          workflowRunId: run.id,
          status: "dead_lettered",
          errorCode: "stuck_workflow_exhausted",
          error: new Error(`Stuck for >${stuckMinutes}min and exhausted ${maxAttempts} attempts`),
        });
        await logAudit({
          action: "workflow.quarantined",
          resourceType: "WorkflowRun",
          resourceId: run.id,
          schoolId: run.schoolId,
          traceId: run.traceId,
          details: { reason: "stuck_and_exhausted", attempt, maxAttempts },
        });
        details.push({ workflowRunId: run.id, action: "quarantined", reason: "stuck_and_exhausted" });
        quarantined++;
      } else {
        const nextRetryAt = new Date(now.getTime() + exponentialBackoffMs(attempt));
        await transitionWorkflowStatus({
          workflowRunId: run.id,
          status: "failed",
          errorCode: "stuck_workflow_reset",
          error: new Error(`Stuck for >${stuckMinutes}min, resetting for retry`),
          nextRetryAt,
        });
        await logAudit({
          action: "workflow.recovery.reset",
          resourceType: "WorkflowRun",
          resourceId: run.id,
          schoolId: run.schoolId,
          traceId: run.traceId,
          details: { reason: "stuck_reset", attempt, nextRetryAt: nextRetryAt.toISOString() },
        });
        details.push({ workflowRunId: run.id, action: "recovered", reason: "stuck_reset_for_retry" });
        recovered++;
      }
    } catch {
      details.push({ workflowRunId: run.id, action: "skipped", reason: "recovery_error" });
      skipped++;
    }
  }

  return { scanned: stuckWorkflows.length, recovered, quarantined, skipped, details };
}

export async function requeueRetryableWorkflows(input: {
  limit?: number;
  now?: Date;
} = {}): Promise<{ requeued: number; skipped: number }> {
  if (!isWorkflowRecoveryCronEnabled()) return { requeued: 0, skipped: 0 };

  const now = input.now ?? new Date();
  const limit = input.limit ?? 25;

  const retryable = await (prisma as any).workflowRun.findMany({
    where: {
      status: "failed",
      nextRetryAt: { not: null, lte: now },
      attempt: { gt: 0 },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
    select: {
      id: true,
      workflowType: true,
      schoolId: true,
      attempt: true,
      maxAttempts: true,
      partitionKey: true,
      idempotencyKey: true,
      traceId: true,
    },
  });

  let requeued = 0;
  let skipped = 0;

  for (const run of retryable) {
    const attempt = run.attempt ?? 0;
    const maxAttempts = run.maxAttempts ?? 3;
    if (attempt >= maxAttempts) {
      skipped++;
      continue;
    }
    try {
      await transitionWorkflowStatus({ workflowRunId: run.id, status: "pending" });
      await enqueueWorkflowRun({
        id: run.id,
        workflowType: run.workflowType,
        partitionKey: run.partitionKey,
        idempotencyKey: run.idempotencyKey,
        attempt: run.attempt,
      });
      requeued++;
    } catch {
      skipped++;
    }
  }

  return { requeued, skipped };
}

export async function runWorkflowRecovery(input: {
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<WorkflowRecoveryResult & { requeued: number }> {
  const recovery = await recoverStuckWorkflows(input);
  const retry = await requeueRetryableWorkflows({ now: input.now });
  return { ...recovery, requeued: retry.requeued };
}
