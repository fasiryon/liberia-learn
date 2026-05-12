import { prisma } from "@/lib/db";
import type { AutonomousCronPipeline } from "@/lib/autonomous/runtime/types";

export type ScheduledJob = {
  pipeline: AutonomousCronPipeline;
  label: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
};

const CRON_SCHEDULES: Record<AutonomousCronPipeline, { label: string; schedule: string; envFlag: string }> = {
  "autonomous.stale_approvals": {
    label: "Stale Approval Expiration",
    schedule: "*/15 * * * *",
    envFlag: "ENABLE_APPROVAL_EXPIRATION_WORKER",
  },
  "autonomous.evaluation_windows": {
    label: "Evaluation Window Processing",
    schedule: "0 * * * *",
    envFlag: "ENABLE_IMPLEMENTATION_WORKFLOW",
  },
  "autonomous.workflow_recovery": {
    label: "Workflow Recovery & Retry",
    schedule: "*/10 * * * *",
    envFlag: "ENABLE_WORKFLOW_RECOVERY_CRON",
  },
  "autonomous.runtime_health": {
    label: "Runtime Health Snapshot",
    schedule: "*/5 * * * *",
    envFlag: "ENABLE_RUNTIME_HEALTH_CRON",
  },
  "autonomous.dead_letter_inspection": {
    label: "Dead-Letter Inspection",
    schedule: "0 */6 * * *",
    envFlag: "ENABLE_DEAD_LETTER_INSPECTION_CRON",
  },
};

function isCronEnabled(envFlag: string): boolean {
  const v = process.env[envFlag];
  if (v != null) return v === "true";
  return false;
}

async function getLastRun(
  pipeline: AutonomousCronPipeline
): Promise<{ lastRunAt: string | null; status: string | null }> {
  const row = await prisma.auditLog.findFirst({
    where: {
      action: `cron.${pipeline}.run`,
      resourceType: "autonomous_cron_run",
      resourceId: pipeline,
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, details: true },
  });
  if (!row) return { lastRunAt: null, status: null };
  const d = (row.details ?? {}) as Record<string, unknown>;
  return {
    lastRunAt: String(d.ranAt ?? row.createdAt.toISOString()),
    status: String(d.status ?? "unknown"),
  };
}

export async function getSchedulerStatus(): Promise<ScheduledJob[]> {
  const pipelines = Object.keys(CRON_SCHEDULES) as AutonomousCronPipeline[];
  const lastRuns = await Promise.all(pipelines.map(getLastRun));

  return pipelines.map((pipeline, i) => {
    const cfg = CRON_SCHEDULES[pipeline];
    return {
      pipeline,
      label: cfg.label,
      schedule: cfg.schedule,
      enabled: isCronEnabled(cfg.envFlag),
      lastRunAt: lastRuns[i].lastRunAt,
      lastRunStatus: lastRuns[i].status,
    };
  });
}
