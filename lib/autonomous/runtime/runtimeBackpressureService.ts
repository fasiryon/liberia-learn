import { prisma } from "@/lib/db";
import { isAutonomousEmergencyShutdownEnabled } from "@/lib/serverFlags";
import type { BackpressureResult } from "@/lib/autonomous/runtime/types";

function numberFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export async function checkBackpressure(): Promise<BackpressureResult> {
  const pendingThreshold = numberFromEnv("AUTONOMOUS_BACKPRESSURE_PENDING_LIMIT", 200);

  if (isAutonomousEmergencyShutdownEnabled()) {
    return {
      active: true,
      reason: "emergency_shutdown",
      pendingWorkflows: 0,
      pendingThreshold,
    };
  }

  const pendingWorkflows = await (prisma as any).workflowRun
    .count({ where: { status: { in: ["pending", "eligible", "running", "executing"] } } })
    .catch(() => 0);

  const active = (pendingWorkflows as number) >= pendingThreshold;
  return {
    active,
    reason: active ? "pending_queue_saturated" : null,
    pendingWorkflows: pendingWorkflows as number,
    pendingThreshold,
  };
}

export async function shouldAllowNewWorkflow(input: {
  schoolId?: string | null;
} = {}): Promise<{ allowed: boolean; reason: string }> {
  const bp = await checkBackpressure();
  if (bp.active) return { allowed: false, reason: bp.reason ?? "backpressure_active" };

  if (input.schoolId) {
    const tenantLimit = numberFromEnv("AUTONOMOUS_TENANT_PENDING_LIMIT", 30);
    const tenantPending = await (prisma as any).workflowRun
      .count({
        where: {
          schoolId: input.schoolId,
          status: { in: ["pending", "eligible", "running", "executing"] },
        },
      })
      .catch(() => 0);
    if ((tenantPending as number) >= tenantLimit) {
      return { allowed: false, reason: "tenant_pending_limit_reached" };
    }
  }

  return { allowed: true, reason: "ok" };
}
