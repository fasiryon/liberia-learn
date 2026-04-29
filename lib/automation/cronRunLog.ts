import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type CronPipeline = "audio" | "textbook";

export type CronRunSummary = {
  pipeline: CronPipeline;
  lastRunAt: string | null;
  jobsProcessedToday: number;
  lastRunProcessed: number;
  lastRunFailed: number;
};

export function isAutoModeEnabled() {
  return Boolean(process.env.CRON_SECRET);
}

export function getCronCostThresholdUsd(pipeline: CronPipeline) {
  const specific =
    pipeline === "audio"
      ? process.env.AUDIO_CRON_MAX_COST_USD
      : process.env.TEXTBOOK_CRON_MAX_COST_USD;
  const raw = specific ?? process.env.CRON_MAX_COST_USD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.POSITIVE_INFINITY;
}

export function shouldStopForFailureRate(processed: number, failed: number) {
  const total = processed + failed;
  return total > 0 && failed / total > 0.2;
}

export async function logCronRun(input: {
  pipeline: CronPipeline;
  processed: number;
  failed: number;
  stoppedReason?: string | null;
  estimatedCostUsd?: number;
}) {
  await logAudit({
    action: `cron.${input.pipeline}.generation.run`,
    resourceType: "cron_generation_run",
    resourceId: input.pipeline,
    details: {
      lastRunAt: new Date().toISOString(),
      jobsProcessed: input.processed,
      failures: input.failed,
      stoppedReason: input.stoppedReason ?? null,
      estimatedCostUsd: Number((input.estimatedCostUsd ?? 0).toFixed(6)),
    },
  });
}

export async function getCronRunSummary(pipeline: CronPipeline): Promise<CronRunSummary> {
  const action = `cron.${pipeline}.generation.run`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [lastRun, todaysRuns] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { action, resourceType: "cron_generation_run", resourceId: pipeline },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, details: true },
    }),
    prisma.auditLog.findMany({
      where: {
        action,
        resourceType: "cron_generation_run",
        resourceId: pipeline,
        createdAt: { gte: today },
      },
      select: { details: true },
    }),
  ]);

  const lastDetails = (lastRun?.details ?? {}) as Record<string, unknown>;
  const jobsProcessedToday = todaysRuns.reduce((sum, run) => {
    const details = (run.details ?? {}) as Record<string, unknown>;
    return sum + Number(details.jobsProcessed ?? 0);
  }, 0);

  return {
    pipeline,
    lastRunAt: lastRun?.createdAt.toISOString() ?? null,
    jobsProcessedToday,
    lastRunProcessed: Number(lastDetails.jobsProcessed ?? 0),
    lastRunFailed: Number(lastDetails.failures ?? 0),
  };
}
