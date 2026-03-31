import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { enrichGeneratedLesson, countLessonWords } from "@/lib/curriculum/generatedLessonEnricher";

config({ path: ".env.local" });
config();

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberArg(flag: string, fallback: number) {
  const value = readArg(flag);
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const target = numberArg("--target", 500);
  const batchSize = numberArg("--batch-size", 100);
  const dryRun = hasFlag("--dry-run");

  const generatedRows = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: "generated",
    },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      payload: true,
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  const bySubject = new Map<string, number>();
  const byGrade = new Map<number, number>();
  const currentWordTotal = generatedRows.reduce((sum, row) => {
    bySubject.set(row.subject, (bySubject.get(row.subject) ?? 0) + 1);
    byGrade.set(row.grade, (byGrade.get(row.grade) ?? 0) + 1);
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
    return sum + countLessonWords(payload);
  }, 0);

  console.log("[GENERATED LESSON ENRICHMENT] Inventory", {
    totalGenerated: generatedRows.length,
    bySubject: Object.fromEntries([...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    byGrade: Object.fromEntries([...byGrade.entries()].sort((a, b) => a[0] - b[0])),
    averageWordCount: generatedRows.length > 0 ? Math.round(currentWordTotal / generatedRows.length) : 0,
    dryRun,
    target,
    batchSize,
  });

  const rowsToProcess = generatedRows.slice(0, target);
  let processed = 0;
  let enriched = 0;
  let totalWordCount = 0;
  let belowThreshold = 0;
  const subjectsImproved = new Set<string>();
  const belowThresholdSamples: Array<{ contentId: string; wordCount: number }> = [];

  for (let index = 0; index < rowsToProcess.length; index += batchSize) {
    const batch = rowsToProcess.slice(index, index + batchSize);
    let batchBelowThreshold = 0;
    let batchWordCount = 0;

    for (const row of batch) {
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
      const result = enrichGeneratedLesson({
        contentId: row.contentId,
        grade: row.grade,
        subject: row.subject,
        payload,
      });

      if (!dryRun) {
        await prisma.curriculumContent.update({
          where: { id: row.id },
          data: { payload: result.payload },
        });
      }

      processed += 1;
      enriched += 1;
      batchWordCount += result.wordCount;
      totalWordCount += result.wordCount;
      subjectsImproved.add(row.subject);

      if (result.belowThreshold) {
        batchBelowThreshold += 1;
        belowThreshold += 1;
        if (belowThresholdSamples.length < 10) {
          belowThresholdSamples.push({ contentId: row.contentId, wordCount: result.wordCount });
        }
      }
    }

    console.log("[GENERATED LESSON ENRICHMENT] Batch", {
      batchNumber: Math.floor(index / batchSize) + 1,
      batchSize: batch.length,
      processed,
      averageWordCount: batch.length > 0 ? Math.round(batchWordCount / batch.length) : 0,
      subjectsCovered: [...new Set(batch.map((row) => row.subject))].sort(),
      belowThresholdInBatch: batchBelowThreshold,
    });
  }

  console.log("[GENERATED LESSON ENRICHMENT] Complete", {
    processed,
    enriched,
    averageWordCount: enriched > 0 ? Math.round(totalWordCount / enriched) : 0,
    subjectsImproved: [...subjectsImproved].sort(),
    belowThreshold,
    belowThresholdSamples,
  });
}

main()
  .catch((error) => {
    console.error("[GENERATED LESSON ENRICHMENT] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
