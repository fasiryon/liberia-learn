import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createCurriculumRegenerationRun } from "@/lib/curriculum/regenerationQueue";
import { getSchedulerConfig, isCurriculumRegenSchedulerEnabled } from "@/lib/curriculum/regenerationAdmin";

export async function runCurriculumRegenerationScheduler() {
  const config = getSchedulerConfig();
  const actor = "curriculum-regeneration-scheduler";

  if (!isCurriculumRegenSchedulerEnabled()) {
    await logAudit({
      userId: null,
      action: "curriculum.regeneration.scheduler.skipped",
      resourceType: "curriculum_regeneration_scheduler",
      details: { reason: "feature_flag_disabled" },
    });
    return { started: false, reason: "feature_flag_disabled", config };
  }

  const activeRun = await prisma.curriculumRegenerationRun.findFirst({
    where: { status: { in: ["pending", "running", "paused"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (activeRun) {
    await logAudit({
      userId: null,
      action: "curriculum.regeneration.scheduler.skipped",
      resourceType: "curriculum_regeneration_run",
      resourceId: activeRun.id,
      details: { reason: "active_run_exists", status: activeRun.status },
    });
    return { started: false, reason: "active_run_exists", activeRun, config };
  }

  const latestRun = await prisma.curriculumRegenerationRun.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (latestRun) {
    const minutesSince = (Date.now() - latestRun.createdAt.getTime()) / 60000;
    if (minutesSince < config.minutesBetweenRuns) {
      await logAudit({
        userId: null,
        action: "curriculum.regeneration.scheduler.skipped",
        resourceType: "curriculum_regeneration_run",
        resourceId: latestRun.id,
        details: { reason: "too_soon", minutesSince },
      });
      return { started: false, reason: "too_soon", latestRunId: latestRun.id, config };
    }
  }

  const recentJobs = await prisma.curriculumRegenerationJob.findMany({
    where: { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, status: { in: ["approved", "failed"] } },
    select: { status: true },
    take: 200,
  });
  const failureRate =
    recentJobs.length === 0 ? 0 : recentJobs.filter((job) => job.status === "failed").length / recentJobs.length;
  if (failureRate > config.maxFailureRate) {
    await logAudit({
      userId: null,
      action: "curriculum.regeneration.scheduler.stopped",
      resourceType: "curriculum_regeneration_scheduler",
      details: { reason: "failure_rate_too_high", failureRate, maxFailureRate: config.maxFailureRate },
    });
    return { started: false, reason: "failure_rate_too_high", failureRate, config };
  }

  const backlog = await prisma.curriculumContent.count({
    where: { status: "NEEDS_REVIEW", contentType: "lesson" },
  });
  if (backlog === 0) {
    await logAudit({
      userId: null,
      action: "curriculum.regeneration.scheduler.skipped",
      resourceType: "curriculum_regeneration_scheduler",
      details: { reason: "no_backlog" },
    });
    return { started: false, reason: "no_backlog", config };
  }

  const result = await createCurriculumRegenerationRun({
    limit: Math.min(config.maxLessons, backlog),
    requestedBy: actor,
  });
  await logAudit({
    userId: null,
    action: "curriculum.regeneration.scheduler.started",
    resourceType: "curriculum_regeneration_run",
    resourceId: "runId" in result ? result.runId : undefined,
    details: { backlog, config },
  });
  return { started: true, backlog, result, config };
}

