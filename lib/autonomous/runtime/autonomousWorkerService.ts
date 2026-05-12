import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isAutonomousEmergencyShutdownEnabled } from "@/lib/serverFlags";

function numberFromEnv(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export async function isWorkflowAlreadyRunning(workflowRunId: string): Promise<boolean> {
  const run = await (prisma as any).workflowRun.findUnique({
    where: { id: workflowRunId },
    select: { status: true, lockedBy: true, lockedUntil: true },
  });
  if (!run) return false;
  if (run.status === "running" || run.status === "executing") return true;
  if (run.lockedBy && run.lockedUntil && new Date(run.lockedUntil) > new Date()) return true;
  return false;
}

export async function releaseExpiredLocks(input: {
  dryRun?: boolean;
} = {}): Promise<{ released: number }> {
  if (isAutonomousEmergencyShutdownEnabled()) return { released: 0 };

  const now = new Date();
  if (input.dryRun) {
    const count = await (prisma as any).workflowRun.count({
      where: { lockedBy: { not: null }, lockedUntil: { lt: now } },
    });
    return { released: count as number };
  }

  const result = await (prisma as any).workflowRun.updateMany({
    where: { lockedBy: { not: null }, lockedUntil: { lt: now } },
    data: { lockedBy: null, lockedUntil: null },
  });

  if (result.count > 0) {
    await logAudit({
      action: "autonomous.worker.locks_released",
      resourceType: "autonomous_worker",
      resourceId: "worker_lock_cleanup",
      details: { released: result.count, at: now.toISOString() },
    });
  }

  return { released: result.count as number };
}

export async function getWorkerStatus(input: {
  schoolId?: string | null;
} = {}): Promise<{
  emergencyShutdown: boolean;
  activeLocks: number;
  expiredLocks: number;
  runningWorkflows: number;
  executingWorkflows: number;
  tenantRunning: number;
  saturationLimit: number;
  tenantSaturationLimit: number;
}> {
  const now = new Date();
  const saturationLimit = numberFromEnv("AUTONOMOUS_ACTIVE_EXECUTION_LIMIT", 100);
  const tenantSaturationLimit = numberFromEnv("AUTONOMOUS_TENANT_ACTIVE_EXECUTION_LIMIT", 15);

  const [activeLocks, expiredLocks, running, executing, tenantRunning] = await Promise.all([
    (prisma as any).workflowRun.count({
      where: { lockedBy: { not: null }, lockedUntil: { gte: now } },
    }),
    (prisma as any).workflowRun.count({
      where: { lockedBy: { not: null }, lockedUntil: { lt: now } },
    }),
    (prisma as any).workflowRun.count({ where: { status: "running" } }),
    (prisma as any).workflowRun.count({ where: { status: "executing" } }),
    input.schoolId
      ? (prisma as any).workflowRun.count({
          where: {
            schoolId: input.schoolId,
            status: { in: ["running", "executing"] },
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    emergencyShutdown: isAutonomousEmergencyShutdownEnabled(),
    activeLocks: activeLocks as number,
    expiredLocks: expiredLocks as number,
    runningWorkflows: running as number,
    executingWorkflows: executing as number,
    tenantRunning: tenantRunning as number,
    saturationLimit,
    tenantSaturationLimit,
  };
}
