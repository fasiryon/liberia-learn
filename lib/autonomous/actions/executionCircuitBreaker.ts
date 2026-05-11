import { prisma } from "@/lib/db";
import { isAutonomousEmergencyShutdownEnabled } from "@/lib/serverFlags";
import type { ExecutionGuardResult } from "@/lib/autonomous/actions/types";

function threshold(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export async function evaluateExecutionCircuit(input: {
  actionType: string;
  schoolId?: string | null;
  now?: Date;
}): Promise<ExecutionGuardResult> {
  if (isAutonomousEmergencyShutdownEnabled()) {
    return { allowed: false, reason: "emergency_shutdown" };
  }
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - 15 * 60_000);
  const failureLimit = threshold("LOW_RISK_AUTONOMY_FAILURE_BREAKER_LIMIT", 5);
  const tenantFailureLimit = threshold("LOW_RISK_AUTONOMY_TENANT_FAILURE_BREAKER_LIMIT", 3);

  const [globalFailures, tenantFailures] = await Promise.all([
    (prisma as any).actionExecution.count({
      where: { actionType: input.actionType, status: "FAILED", updatedAt: { gte: since } },
    }),
    input.schoolId
      ? (prisma as any).actionExecution.count({
          where: { actionType: input.actionType, schoolId: input.schoolId, status: "FAILED", updatedAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  if (globalFailures >= failureLimit) return { allowed: false, reason: "global_circuit_open", metrics: { globalFailures, failureLimit } };
  if (input.schoolId && tenantFailures >= tenantFailureLimit) {
    return { allowed: false, reason: "tenant_circuit_open", metrics: { tenantFailures, tenantFailureLimit } };
  }
  return { allowed: true, reason: "circuit_closed", metrics: { globalFailures, tenantFailures, failureLimit, tenantFailureLimit } };
}

