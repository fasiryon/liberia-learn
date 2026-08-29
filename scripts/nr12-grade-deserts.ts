/**
 * NR-12 operational runner.
 *
 * `dry_run` is the safe default and never opens Prisma. `generate` writes
 * governed pending candidates only when NR12_ALLOW_WRITE=true. `full` then
 * routes each candidate through the shared risk-triage approval path. This
 * script is intentionally not run by the repository audit or CI.
 */
import { generateNationalBatch } from "../lib/curriculum/nationalFactory";
import type { BatchResult } from "../lib/curriculum/nationalFactory";
import { NR12_SUBJECTS, NR12_TARGET_LESSONS, NR12_VERSION } from "../lib/curriculum/nr12GradeDeserts";
import { triageAndApprove } from "../lib/curriculum/riskTriage";
import { prisma } from "../lib/db";
import { countLessonWords } from "../lib/curriculum/generatedLessonEnricher";

const action = process.argv[2] ?? "dry_run";
const canWrite = process.env.NR12_ALLOW_WRITE === "true";

export function isCompleteNr12Batch(runAction: string, grade: number, subject: string, batch: BatchResult | undefined): boolean {
  const completedOutcomes = batch?.items.filter((item) => item.outcome === "saved" || item.outcome === "skipped_duplicate").length ?? 0;
  const dryRunComplete = runAction === "dry_run"
    && !!batch
    && batch.attempted === NR12_TARGET_LESSONS
    && batch.passed === NR12_TARGET_LESSONS
    && batch.failed === 0
    && batch.items.length === NR12_TARGET_LESSONS
    && batch.items.every((item) => item.outcome === "dry_run");
  const persistedComplete = runAction !== "dry_run"
    && !!batch
    && batch.failed === 0
    && batch.items.length === NR12_TARGET_LESSONS
    && completedOutcomes === NR12_TARGET_LESSONS;
  return !!batch && batch.grade === grade && batch.subject === subject && (dryRunComplete || persistedComplete);
}

async function run() {
  if (action !== "dry_run" && !canWrite) {
    throw new Error("NR12_ALLOW_WRITE=true is required for database-writing actions");
  }

  const summaries = [];
  for (const grade of [2, 9]) {
    for (const subject of NR12_SUBJECTS) {
      const summary = await generateNationalBatch({
        grade,
        subject,
        batchSize: 15,
        dryRun: action === "dry_run",
        sessionId: `nr12-${grade}-${subject.toLowerCase()}-${NR12_VERSION}`,
      });
      summaries.push(summary);
      const batch = summary.batches[0];
      const completedOutcomes = batch?.items.filter((item) => item.outcome === "saved" || item.outcome === "skipped_duplicate").length ?? 0;
      if (!isCompleteNr12Batch(action, grade, subject, batch)) {
        throw new Error(`NR-12 runner produced an incomplete batch for G${grade} ${subject}: attempted=${batch?.attempted ?? 0} passed=${batch?.passed ?? 0} failed=${batch?.failed ?? 0} completed=${completedOutcomes}`);
      }
      console.log(`G${grade} ${subject}: attempted=${batch?.attempted ?? 0} passed=${batch?.passed ?? 0} failed=${batch?.failed ?? 0} mode=${action}`);
    }
  }

  if (action !== "full") return;

  const pending = await prisma.curriculumContent.findMany({
    where: { version: NR12_VERSION, status: { in: ["pending_approval", "draft", "DRAFT"] } },
    select: { contentId: true, grade: true, subject: true, payload: true },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  for (const lesson of pending) {
    const payload = (lesson.payload ?? {}) as Record<string, unknown>;
    const result = await triageAndApprove(
      {
        contentId: lesson.contentId,
        grade: lesson.grade,
        subject: lesson.subject,
        payload,
        wordCount: countLessonWords(payload as any),
        minWordCount: 3500,
      },
      "system:nr12-grade-deserts",
      "APPROVED",
    );
    console.log(`${result.action.toUpperCase()} ${lesson.contentId} risk=${result.riskScore}`);
  }

  void summaries;
}

const invokedScript = process.argv[1]?.replace(/\\/g, "/");
if (invokedScript?.endsWith("/scripts/nr12-grade-deserts.ts") || invokedScript?.endsWith("/scripts/nr12-grade-deserts.js")) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    if (action !== "dry_run") await prisma.$disconnect();
  });
}
