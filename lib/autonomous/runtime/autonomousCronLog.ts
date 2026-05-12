import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AutonomousCronPipeline, AutonomousCronRunRecord, CronRunStatus } from "@/lib/autonomous/runtime/types";

export async function logAutonomousCronRun(input: {
  pipeline: AutonomousCronPipeline;
  status: CronRunStatus;
  processed: number;
  failed: number;
  durationMs: number;
  error?: string | null;
}): Promise<void> {
  await logAudit({
    action: `cron.${input.pipeline}.run`,
    resourceType: "autonomous_cron_run",
    resourceId: input.pipeline,
    details: {
      ranAt: new Date().toISOString(),
      status: input.status,
      processed: input.processed,
      failed: input.failed,
      durationMs: input.durationMs,
      error: input.error ?? null,
    },
  });
}

export async function getAutonomousCronHistory(
  pipeline: AutonomousCronPipeline,
  limit = 20
): Promise<AutonomousCronRunRecord[]> {
  const action = `cron.${pipeline}.run`;
  const rows = await prisma.auditLog.findMany({
    where: { action, resourceType: "autonomous_cron_run", resourceId: pipeline },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { createdAt: true, details: true },
  });

  return rows.map((row) => {
    const d = (row.details ?? {}) as Record<string, unknown>;
    return {
      pipeline,
      ranAt: String(d.ranAt ?? row.createdAt.toISOString()),
      durationMs: Number(d.durationMs ?? 0),
      processed: Number(d.processed ?? 0),
      failed: Number(d.failed ?? 0),
      status: (d.status as CronRunStatus) ?? "ok",
      error: (d.error as string | null) ?? null,
    };
  });
}

export async function getAllAutonomousCronHistory(limit = 10): Promise<AutonomousCronRunRecord[]> {
  const pipelines: AutonomousCronPipeline[] = [
    "autonomous.stale_approvals",
    "autonomous.evaluation_windows",
    "autonomous.workflow_recovery",
    "autonomous.runtime_health",
    "autonomous.dead_letter_inspection",
  ];
  const results = await Promise.all(pipelines.map((p) => getAutonomousCronHistory(p, limit)));
  return results
    .flat()
    .sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime())
    .slice(0, limit * pipelines.length);
}
