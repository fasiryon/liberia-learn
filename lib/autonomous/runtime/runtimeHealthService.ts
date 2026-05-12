import { prisma } from "@/lib/db";
import { isQueueConfigured } from "@/lib/queue";
import { getExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";
import {
  isAutonomousEmergencyShutdownEnabled,
  isAutonomousDegradedModeEnabled,
} from "@/lib/serverFlags";
import type { RuntimeHealthStatus, RuntimeHealthSummary } from "@/lib/autonomous/runtime/types";

function numberFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

async function dbPing(): Promise<boolean> {
  try {
    await (prisma as any).workflowRun.findFirst({ take: 1, select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

export async function getRuntimeHealthSummary(input: {
  schoolId?: string | null;
} = {}): Promise<RuntimeHealthSummary> {
  const now = new Date();
  const stuckMinutes = numberFromEnv("AUTONOMOUS_STUCK_WORKFLOW_MINUTES", 45);
  const stuckSince = new Date(now.getTime() - stuckMinutes * 60_000);
  const recentWindow = new Date(now.getTime() - 60 * 60_000);

  const [execHealth, dbReachable, stuckWorkflows, deadLetterCount, recentTotal, recentFailed] =
    await Promise.all([
      getExecutionHealth(input).catch(() => null),
      dbPing(),
      (prisma as any).workflowRun
        .count({ where: { status: { in: ["running", "executing"] }, updatedAt: { lt: stuckSince } } })
        .catch(() => 0),
      (prisma as any).workflowRun.count({ where: { status: "dead_lettered" } }).catch(() => 0),
      (prisma as any).workflowRun
        .count({ where: { createdAt: { gte: recentWindow } } })
        .catch(() => 0),
      (prisma as any).workflowRun
        .count({ where: { status: "failed", updatedAt: { gte: recentWindow } } })
        .catch(() => 0),
    ]);

  const emergencyShutdown = isAutonomousEmergencyShutdownEnabled();
  const degradedMode = isAutonomousDegradedModeEnabled();
  const queueConfigured = isQueueConfigured();
  const activeExecutions = execHealth?.activeGlobal ?? 0;
  const backpressureActive = execHealth?.status === "saturated" || stuckWorkflows > 0;
  const recentFailureRate =
    typeof recentTotal === "number" && recentTotal > 0
      ? Number(((recentFailed as number) / recentTotal).toFixed(3))
      : null;

  const signals: string[] = [];
  if (emergencyShutdown) signals.push("emergency_shutdown_active");
  if (degradedMode) signals.push("degraded_mode_active");
  if (!queueConfigured) signals.push("queue_not_configured");
  if (!dbReachable) signals.push("db_unreachable");
  if ((stuckWorkflows as number) > 0) signals.push(`stuck_workflows:${stuckWorkflows}`);
  if ((deadLetterCount as number) > 0) signals.push(`dead_letter_items:${deadLetterCount}`);
  if (recentFailureRate !== null && recentFailureRate > 0.3)
    signals.push(`high_failure_rate:${Math.round(recentFailureRate * 100)}pct`);
  if (backpressureActive) signals.push("backpressure_active");

  let status: RuntimeHealthStatus = "healthy";
  if (emergencyShutdown) status = "shutdown";
  else if (!dbReachable) status = "degraded";
  else if (execHealth?.status === "saturated") status = "saturated";
  else if (degradedMode || (stuckWorkflows as number) > 0 || !queueConfigured) status = "degraded";

  return {
    status,
    timestamp: now.toISOString(),
    queueConfigured,
    dbReachable,
    activeExecutions,
    stuckWorkflows: stuckWorkflows as number,
    deadLetterCount: deadLetterCount as number,
    recentFailureRate,
    backpressureActive,
    emergencyShutdown,
    degradedMode,
    signals,
  };
}
