/**
 * scripts/process-regen-jobs-direct.ts
 *
 * Processes pending CurriculumRegenerationJob records directly — no SQS/ECS required.
 * Generates lesson content, validates depth gate, and writes APPROVED lessons to DB.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 50
 *   npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 50 --subject SCIENCE --grade 7
 *
 * Flags:
 *   --limit N       process at most N jobs (default: all pending)
 *   --subject X     filter to a specific subject (e.g. SCIENCE, MATH)
 *   --grade N       filter to a specific grade level
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import {
  validateLessonDepth,
  extractLessonText,
} from "@/lib/curriculum/regenerationQualityGate";
import { createHash } from "crypto";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 3000;

function readArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readNumberArg(flag: string): number | undefined {
  const v = readArg(flag);
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

function contentHash(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 40);
}

function msToSecs(ms: number) {
  return (ms / 1000).toFixed(1) + "s";
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function alignmentCodes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const codes = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof (item as { code?: unknown }).code === "string") {
        return String((item as { code: string }).code).trim();
      }
      return "";
    })
    .filter(Boolean);
  return codes.length ? codes : undefined;
}

async function processJob(
  job: {
    id: string;
    runId: string;
    curriculumContentId: string;
    gradeLevel: number;
    subject: string;
    topic: string | null;
    attempt: number;
    idempotencyKey: string;
  },
  index: number,
  total: number
): Promise<{ status: "ok" | "fail" | "skip"; slideCount?: number; wordCount?: number; durationMs: number }> {
  const start = Date.now();
  const label = `[${index + 1}/${total}] G${job.gradeLevel} ${job.subject}`;

  const lesson = await prisma.curriculumContent.findUnique({
    where: { contentId: job.curriculumContentId },
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      status: true,
      moeAlignments: true,
    },
  });

  if (!lesson || lesson.status !== "NEEDS_REVIEW") {
    await prisma.curriculumRegenerationJob.update({
      where: { id: job.id },
      data: { status: "skipped", lastErrorCode: "not_needs_review", lastErrorMessage: `Skipped: content status is ${lesson?.status ?? "not_found"}` },
    });
    const ms = Date.now() - start;
    console.log(`${label} — ${job.topic ?? job.curriculumContentId} — SKIP (${msToSecs(ms)})`);
    return { status: "skip", durationMs: ms };
  }

  const topic =
    job.topic?.trim() ||
    lesson.title?.trim() ||
    `${lesson.subject} Grade ${lesson.grade}`;

  try {
    const generated = await generateCurriculumPayload({
      grade: lesson.grade,
      subject: lesson.subject,
      topic,
      contentType: "lesson",
      moeAlignmentCodes: alignmentCodes(lesson.moeAlignments),
      lessonFormat: "either",
      liberiaContext: true,
      forceSmartTier: true,
    });

    const depth = validateLessonDepth(generated, lesson.grade);

    if (!depth.valid) {
      const reason = depth.failReasons.join("; ");
      await prisma.curriculumRegenerationJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          attempt: { increment: 1 },
          lastErrorCode: "depth_gate_failure",
          lastErrorMessage: reason.slice(0, 2000),
        },
      });
      const ms = Date.now() - start;
      console.log(
        `${label} — ${topic} — FAIL (depth: ${depth.slideCount} slides, ${depth.wordCount} words) [${msToSecs(ms)}]`
      );
      return { status: "fail", slideCount: depth.slideCount, wordCount: depth.wordCount, durationMs: ms };
    }

    const lessonContent = extractLessonText(generated);
    const nextPayload = {
      ...generated,
      lessonContent,
      approvalStatus: "APPROVED",
      generationMetadata: {
        ...(typeof generated.metadata === "object" && generated.metadata ? generated.metadata : {}),
        regeneratedFromStatus: "NEEDS_REVIEW",
        regenerationRunId: job.runId,
        regenerationJobId: job.id,
        depthSlideCount: depth.slideCount,
        depthWordCount: depth.wordCount,
        generatedAt: new Date().toISOString(),
        processedByDirectScript: true,
      },
    };

    await prisma.$transaction([
      prisma.curriculumContent.update({
        where: { contentId: job.curriculumContentId },
        data: {
          title: generated.title ?? lesson.title,
          status: "APPROVED",
          payload: nextPayload as any,
          hash: contentHash(nextPayload),
          updatedAt: new Date(),
        },
      }),
      prisma.curriculumRegenerationJob.update({
        where: { id: job.id },
        data: {
          status: "approved",
          attempt: { increment: 1 },
          lastErrorCode: null,
          lastErrorMessage: `slides:${depth.slideCount} words:${depth.wordCount}`,
        },
      }),
      prisma.curriculumRegenerationRun.update({
        where: { id: job.runId },
        data: {
          totalProcessed: { increment: 1 },
          totalApproved: { increment: 1 },
          status: "running",
        },
      }),
    ]);

    const ms = Date.now() - start;
    console.log(
      `${label} — ${topic} — OK (slides: ${depth.slideCount}, words: ${depth.wordCount}) [${msToSecs(ms)}]`
    );
    return { status: "ok", slideCount: depth.slideCount, wordCount: depth.wordCount, durationMs: ms };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.curriculumRegenerationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        attempt: { increment: 1 },
        lastErrorCode: "generation_error",
        lastErrorMessage: message.slice(0, 2000),
      },
    });
    const ms = Date.now() - start;
    console.log(`${label} — ${topic} — ERROR: ${message.slice(0, 120)} [${msToSecs(ms)}]`);
    return { status: "fail", durationMs: ms };
  }
}

async function main() {
  const limit = readNumberArg("--limit");
  const subject = readArg("--subject")?.toUpperCase();
  const grade = readNumberArg("--grade");

  console.log("[REGEN] Starting direct lesson regeneration processor");
  console.log(`[REGEN] Filters: limit=${limit ?? "all"} subject=${subject ?? "all"} grade=${grade ?? "all"}`);

  const whereClause: Record<string, unknown> = {
    status: { in: ["pending", "failed"] },
  };
  if (subject) whereClause.subject = subject;
  if (grade) whereClause.gradeLevel = grade;

  const jobs = await prisma.curriculumRegenerationJob.findMany({
    where: whereClause as any,
    orderBy: [{ gradeLevel: "asc" }, { subject: "asc" }, { createdAt: "asc" }],
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      runId: true,
      curriculumContentId: true,
      gradeLevel: true,
      subject: true,
      topic: true,
      attempt: true,
      idempotencyKey: true,
    },
  });

  const total = jobs.length;
  console.log(`[REGEN] Found ${total} jobs to process\n`);

  if (total === 0) {
    console.log("[REGEN] Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let failed = 0;
  let skipped = 0;

  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = jobs.slice(batchStart, batchStart + BATCH_SIZE);

    for (let i = 0; i < batch.length; i++) {
      const result = await processJob(batch[i], batchStart + i, total);
      if (result.status === "ok") ok++;
      else if (result.status === "fail") failed++;
      else skipped++;
    }

    if (batchStart + BATCH_SIZE < total) {
      console.log(`\n[REGEN] Batch complete. Waiting ${BATCH_DELAY_MS / 1000}s before next batch...\n`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n[REGEN] Done. ${ok} OK / ${failed} FAILED / ${skipped} SKIPPED out of ${total} jobs.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[REGEN] Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
