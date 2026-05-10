import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { enqueueJob, JobType } from "@/lib/queue";
import { isCurriculumRegenQueueEnabled } from "@/lib/serverFlags";
import { finalizeCurriculumRegenerationRun } from "@/lib/curriculum/regenerationQueue";

config({ path: ".env.local" });
config();

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const runId = readArg("--run-id") ?? process.argv[2];
  if (!runId) throw new Error("--run-id is required");
  if (!isCurriculumRegenQueueEnabled()) throw new Error("ENABLE_CURRICULUM_REGEN_QUEUE must be true to resume.");

  const finalization = await finalizeCurriculumRegenerationRun(runId);
  const run = await prisma.curriculumRegenerationRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  if (run?.status === "completed" || run?.status === "completed_with_errors") {
    console.log(JSON.stringify({
      action: "curriculum_regeneration_resume",
      runId,
      groupsEnqueued: 0,
      skipped: true,
      reason: "run_already_finalized",
      finalization,
    }, null, 2));
    return;
  }

  await prisma.curriculumRegenerationRun.update({
    where: { id: runId },
    data: { status: "running", stoppedReason: null, completedAt: null },
  });
  const checkpoints = await prisma.curriculumRegenerationCheckpoint.findMany({
    where: { runId, status: { not: "completed" } },
    orderBy: [{ gradeLevel: "asc" }, { subject: "asc" }],
  });

  for (const checkpoint of checkpoints) {
    await enqueueJob(JobType.CURRICULUM_REGENERATE_RESUME, {
      runId,
      gradeLevel: checkpoint.gradeLevel,
      subject: checkpoint.subject,
    });
  }

  console.log(JSON.stringify({
    action: "curriculum_regeneration_resume",
    runId,
    groupsEnqueued: checkpoints.length,
  }, null, 2));
}

main().catch((error) => {
  console.error("[CURRICULUM_REGEN_RESUME] failed", error);
  process.exitCode = 1;
});
