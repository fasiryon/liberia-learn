import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

config({ path: ".env.local" });
config();

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const runId = readArg("--run-id") ?? process.argv[2];
  if (!runId) throw new Error("--run-id is required");

  const run = await prisma.curriculumRegenerationRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true, totalPlanned: true, totalProcessed: true },
  });
  if (!run) throw new Error(`Regeneration run ${runId} not found`);

  const staleJobs = await prisma.curriculumRegenerationJob.findMany({
    where: { runId, status: "pending" },
    select: { id: true },
  });

  if (!["completed", "completed_with_errors"].includes(run.status) || staleJobs.length === 0) {
    console.log(JSON.stringify({
      action: "curriculum_regeneration_cleanup_stale",
      cleaned: false,
      runId,
      runStatus: run.status,
      stalePendingJobs: staleJobs.length,
    }, null, 2));
    return;
  }

  const message =
    "Stale pending cleanup: run was already finalized; job will not be regenerated or re-enqueued.";

  await prisma.$transaction(async (tx) => {
    await tx.curriculumRegenerationJob.updateMany({
      where: { runId, status: "pending" },
      data: {
        status: "skipped",
        lastErrorCode: "stale_pending_cleanup",
        lastErrorMessage: message,
      },
    });
    await tx.curriculumRegenerationCheckpoint.updateMany({
      where: { runId, status: { not: "completed" } },
      data: {
        status: "completed",
        processedCount: run.totalPlanned,
      },
    });
    await tx.curriculumRegenerationRun.update({
      where: { id: runId },
      data: {
        totalProcessed: Math.max(run.totalProcessed, run.totalPlanned),
        stoppedReason: message,
      },
    });
  });

  await logAudit({
    userId: null,
    action: "curriculum.regeneration.stale_pending_cleanup",
    resourceType: "curriculum_regeneration_run",
    resourceId: runId,
    details: { skippedJobs: staleJobs.length, reason: message },
  });

  console.log(JSON.stringify({
    action: "curriculum_regeneration_cleanup_stale",
    cleaned: true,
    runId,
    skippedJobs: staleJobs.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[CURRICULUM_REGEN_CLEANUP_STALE] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

