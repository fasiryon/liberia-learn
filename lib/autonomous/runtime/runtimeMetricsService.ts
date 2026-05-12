import { prisma } from "@/lib/db";
import type { RuntimeMetricsSummary } from "@/lib/autonomous/runtime/types";

function numberFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function windowDate(hours: number) {
  return new Date(Date.now() - hours * 60 * 60_000);
}

export async function getRuntimeMetrics(input: {
  windowHours?: number;
} = {}): Promise<RuntimeMetricsSummary> {
  const now = new Date();
  const hours = input.windowHours ?? 24;
  const from = windowDate(hours);
  const stuckMinutes = numberFromEnv("AUTONOMOUS_STUCK_WORKFLOW_MINUTES", 45);
  const stuckSince = new Date(now.getTime() - stuckMinutes * 60_000);
  const retryBudgetLimit = numberFromEnv("AUTONOMOUS_DAILY_RETRY_BUDGET", 500);

  const [
    totalWorkflows,
    pendingWorkflows,
    runningWorkflows,
    succeededWorkflows,
    failedWorkflows,
    deadLetteredWorkflows,
    stuckCount,
    retryBudgetUsed,
    pendingApprovals,
    overdueApprovals,
    openEvalWindows,
    dueEvalWindows,
  ] = await Promise.all([
    (prisma as any).workflowRun.count({ where: { createdAt: { gte: from } } }),
    (prisma as any).workflowRun.count({ where: { status: { in: ["pending", "eligible"] } } }),
    (prisma as any).workflowRun.count({ where: { status: { in: ["running", "executing"] } } }),
    (prisma as any).workflowRun.count({ where: { status: "succeeded", updatedAt: { gte: from } } }),
    (prisma as any).workflowRun.count({ where: { status: "failed", updatedAt: { gte: from } } }),
    (prisma as any).workflowRun.count({ where: { status: "dead_lettered" } }),
    (prisma as any).workflowRun.count({
      where: { status: { in: ["running", "executing"] }, updatedAt: { lt: stuckSince } },
    }),
    (prisma as any).workflowRun.count({
      where: { attempt: { gt: 1 }, updatedAt: { gte: from } },
    }),
    (prisma as any).approvalRequest
      .count({ where: { status: "pending" } })
      .catch(() => 0),
    (prisma as any).approvalRequest
      .count({ where: { status: "pending", expiresAt: { lt: now } } })
      .catch(() => 0),
    (prisma as any).postChangeEvaluationPlan
      .count({ where: { feedbackLoopStatus: { not: "COMPLETE" } } })
      .catch(() => 0),
    (prisma as any).postChangeEvaluationPlan
      .findMany({
        where: { feedbackLoopStatus: { not: "COMPLETE" } },
        select: { createdAt: true, evaluationWindowDays: true },
        take: 500,
      })
      .then((plans: any[]) => {
        const nowMs = Date.now();
        return plans.filter(
          (p) =>
            nowMs >= p.createdAt.getTime() + (p.evaluationWindowDays ?? 30) * 24 * 60 * 60 * 1000
        ).length;
      })
      .catch(() => 0),
  ]);

  return {
    timestamp: now.toISOString(),
    range: { from: from.toISOString(), to: now.toISOString() },
    workflows: {
      total: totalWorkflows as number,
      pending: pendingWorkflows as number,
      running: runningWorkflows as number,
      succeeded: succeededWorkflows as number,
      failed: failedWorkflows as number,
      deadLettered: deadLetteredWorkflows as number,
      stuckCount: stuckCount as number,
    },
    retryBudget: {
      used: retryBudgetUsed as number,
      limit: retryBudgetLimit,
      exhausted: (retryBudgetUsed as number) >= retryBudgetLimit,
    },
    approvals: {
      pending: pendingApprovals as number,
      overdue: overdueApprovals as number,
    },
    evaluationWindows: {
      open: openEvalWindows as number,
      due: dueEvalWindows as number,
    },
  };
}
