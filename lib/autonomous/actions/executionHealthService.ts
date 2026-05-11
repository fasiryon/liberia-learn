import { prisma } from "@/lib/db";
import { isAutonomousDegradedModeEnabled, isAutonomousEmergencyShutdownEnabled } from "@/lib/serverFlags";
import { isQueueConfigured } from "@/lib/queue";
import type { ExecutionGuardResult, WorkerHealthStatus } from "@/lib/autonomous/actions/types";

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function getExecutionHealth(input: { schoolId?: string | null; now?: Date } = {}) {
  const now = input.now ?? new Date();
  const staleSince = new Date(now.getTime() - numberFromEnv("AUTONOMOUS_STALE_EXECUTION_MINUTES", 30) * 60_000);
  const saturationLimit = numberFromEnv("AUTONOMOUS_ACTIVE_EXECUTION_LIMIT", 100);
  const tenantSaturationLimit = numberFromEnv("AUTONOMOUS_TENANT_ACTIVE_EXECUTION_LIMIT", 15);
  const [activeGlobal, activeTenant, staleRunning] = await Promise.all([
    (prisma as any).actionExecution.count({ where: { status: { in: ["PREPARED", "EXECUTING"] } } }),
    input.schoolId
      ? (prisma as any).actionExecution.count({ where: { schoolId: input.schoolId, status: { in: ["PREPARED", "EXECUTING"] } } })
      : Promise.resolve(0),
    (prisma as any).actionExecution.count({ where: { status: "EXECUTING", updatedAt: { lt: staleSince } } }),
  ]);

  let status: WorkerHealthStatus = "healthy";
  if (isAutonomousEmergencyShutdownEnabled()) status = "shutdown";
  else if (activeGlobal >= saturationLimit || activeTenant >= tenantSaturationLimit) status = "saturated";
  else if (isAutonomousDegradedModeEnabled() || staleRunning > 0 || !isQueueConfigured()) status = "degraded";

  return {
    status,
    queueConfigured: isQueueConfigured(),
    activeGlobal,
    activeTenant,
    staleRunning,
    saturationLimit,
    tenantSaturationLimit,
  };
}

export async function evaluateExecutionHealth(input: { schoolId?: string | null; now?: Date } = {}): Promise<ExecutionGuardResult> {
  const health = await getExecutionHealth(input);
  if (health.status === "shutdown") return { allowed: false, reason: "emergency_shutdown", metrics: health };
  if (health.status === "saturated") return { allowed: false, reason: "worker_saturated", metrics: health };
  return { allowed: true, reason: health.status === "degraded" ? "degraded_mode_allowed_for_low_risk" : "worker_healthy", degradedMode: health.status === "degraded", metrics: health };
}

