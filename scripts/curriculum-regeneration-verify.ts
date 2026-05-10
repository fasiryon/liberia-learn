import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { extractLessonText } from "@/lib/curriculum/regenerationQualityGate";

config({ path: ".env.local" });
config();

async function main() {
  const [needsReview, drafts, activeJobs, activeRuns, published, duplicateHashes, completedRuns, activeRunRows, activeJobRows] = await Promise.all([
    prisma.curriculumContent.count({ where: { status: "NEEDS_REVIEW", contentType: "lesson" } }),
    prisma.curriculumContent.count({ where: { status: "DRAFT", contentType: "lesson" } }),
    prisma.curriculumRegenerationJob.count({ where: { status: { in: ["pending", "processing"] } } }),
    prisma.curriculumRegenerationRun.count({ where: { status: { in: ["pending", "running", "paused"] } } }),
    prisma.curriculumContent.findMany({
      where: { status: "published", contentType: "lesson" },
      select: { contentId: true, payload: true },
    }),
    prisma.curriculumContent.groupBy({
      by: ["hash"],
      where: { hash: { not: null } },
      _count: { _all: true },
      having: { hash: { _count: { gt: 1 } } },
    }),
    prisma.curriculumRegenerationRun.count({
      where: { status: { in: ["completed", "completed_with_errors"] } },
    }),
    prisma.curriculumRegenerationRun.findMany({
      where: { status: { in: ["pending", "running", "paused"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, status: true, totalPlanned: true, totalProcessed: true, totalApproved: true, totalFailed: true, createdAt: true },
    }),
    prisma.curriculumRegenerationJob.findMany({
      where: { status: { in: ["pending", "processing"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, runId: true, curriculumContentId: true, status: true, attempt: true, updatedAt: true },
    }),
  ]);

  console.log(JSON.stringify({
    needsReview,
    drafts,
    approvedThinUnder800: published.filter((row) => extractLessonText(row.payload).length < 800).length,
    duplicateReplacementHashes: duplicateHashes.length,
    activeJobs,
    activeRuns,
    queueDrainedByDbState: activeJobs === 0 && activeRuns === 0,
    completedRuns,
    activeRunRows,
    activeJobRows,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[CURRICULUM_REGEN_VERIFY] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
