import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isDeadLetterInspectionCronEnabled } from "@/lib/serverFlags";
import type { DeadLetterItem, DeadLetterSummary } from "@/lib/autonomous/runtime/types";

const REPLAY_ELIGIBLE_ERROR_CODES = new Set([
  "stuck_workflow_reset",
  "transient_dependency_failure",
  "queue_timeout",
  "lock_unavailable",
]);

function isReplayEligible(run: any): boolean {
  return (
    REPLAY_ELIGIBLE_ERROR_CODES.has(run.lastErrorCode ?? "") ||
    String(run.executionMetadata?.replayEligible ?? "").toLowerCase() === "true"
  );
}

function isQuarantined(run: any): boolean {
  return (
    String(run.executionMetadata?.quarantined ?? "").toLowerCase() === "true" ||
    run.lastErrorCode === "stuck_workflow_exhausted"
  );
}

export async function getDeadLetterSummary(input: {
  schoolId?: string | null;
  limit?: number;
} = {}): Promise<DeadLetterSummary> {
  const where: any = { status: "dead_lettered" };
  if (input.schoolId) where.schoolId = input.schoolId;

  const items = await (prisma as any).workflowRun.findMany({
    where,
    orderBy: { deadLetteredAt: "desc" },
    take: input.limit ?? 100,
    select: {
      id: true,
      workflowType: true,
      schoolId: true,
      deadLetteredAt: true,
      attempt: true,
      maxAttempts: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      executionMetadata: true,
    },
  });

  const mapped: DeadLetterItem[] = items.map((run: any) => ({
    workflowRunId: run.id,
    workflowType: run.workflowType,
    schoolId: run.schoolId ?? null,
    deadLetteredAt: run.deadLetteredAt?.toISOString() ?? null,
    attempt: run.attempt ?? 0,
    maxAttempts: run.maxAttempts ?? 3,
    lastErrorCode: run.lastErrorCode ?? null,
    lastErrorMessage: run.lastErrorMessage
      ? String(run.lastErrorMessage).slice(0, 200)
      : null,
    replayEligible: isReplayEligible(run),
    quarantined: isQuarantined(run),
  }));

  return {
    total: mapped.length,
    replayEligible: mapped.filter((i) => i.replayEligible).length,
    quarantined: mapped.filter((i) => i.quarantined).length,
    items: mapped,
  };
}

export async function runDeadLetterInspection(input: {
  actorId?: string | null;
  dryRun?: boolean;
} = {}): Promise<{ inspected: number; flaggedForReplay: number; flaggedForQuarantine: number }> {
  if (!isDeadLetterInspectionCronEnabled()) {
    return { inspected: 0, flaggedForReplay: 0, flaggedForQuarantine: 0 };
  }

  const summary = await getDeadLetterSummary({ limit: 200 });
  const inspected = summary.total;
  let flaggedForReplay = 0;
  let flaggedForQuarantine = 0;

  if (!input.dryRun && inspected > 0) {
    await logAudit({
      action: "autonomous.dead_letter.inspection.run",
      resourceType: "autonomous_cron_run",
      resourceId: "dead_letter_inspection",
      details: {
        inspected,
        replayEligible: summary.replayEligible,
        quarantined: summary.quarantined,
        actorId: input.actorId ?? null,
        ranAt: new Date().toISOString(),
      },
    });
    flaggedForReplay = summary.replayEligible;
    flaggedForQuarantine = summary.quarantined;
  }

  return { inspected, flaggedForReplay, flaggedForQuarantine };
}
