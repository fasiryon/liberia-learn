import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_TTS_VOICE,
  estimateTtsCostUsd,
  generateLessonAudioNow,
} from "@/lib/lessons/audioGeneration";
import { isTtsGenerationStopped } from "@/lib/serverFlags";
import { selectStudentLessonAudioText } from "@/lib/curriculum/studentLessonProjection";
import {
  isLessonAudioIntegrityCurrent,
  readLessonAudioIntegrityFromParts,
  sha256Text,
} from "@/lib/audio/lessonAudioIntegrity";

const MAX_BATCH_SIZE = 5;

export type EnqueueLessonAudioInput = {
  grade: number;
  subject: string;
  contentIds?: string[];
  limit?: number;
  voice?: string;
  provider?: "openai";
};

export type QueueStatus = {
  pending: number;
  processing: number;
  generated: number;
  failed: number;
  lastProcessed: string | null;
  totalCostUsd: number;
};

export type ProcessResult = {
  jobId: string;
  lessonId: string;
  status: "GENERATED" | "FAILED" | "STALE";
  url?: string;
  error?: string;
};

async function notifyGradeOrchestrator(input: {
  grade?: number | null;
  subject?: string | null;
  errorMessage?: string;
}) {
  if (!input.grade || !input.subject) return;
  try {
    const { refreshGradeStatusForQueueEvent } = await import("@/lib/pipeline/gradeOrchestrator");
    await refreshGradeStatusForQueueEvent({
      grade: input.grade,
      subject: input.subject,
      errorMessage: input.errorMessage,
    });
  } catch {
    // Queue processing must not fail because orchestration status refresh is unavailable.
  }
}

function extractAudioText(payload: unknown): string {
  return selectStudentLessonAudioText(payload);
}

export async function enqueueLessonAudio(
  input: EnqueueLessonAudioInput
): Promise<{ queued: number; skipped: number; total: number }> {
  const voice = input.voice ?? DEFAULT_TTS_VOICE;
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const subject = input.subject.trim().toUpperCase();

  const lessons = await prisma.curriculumContent.findMany({
    where: {
      grade: input.grade,
      subject,
      contentType: "lesson",
      status: "APPROVED",
      ...(input.contentIds?.length ? { contentId: { in: input.contentIds } } : {}),
    },
    orderBy: [{ unitId: "asc" }, { orderInUnit: "asc" }],
    take: limit,
    select: {
      contentId: true,
      version: true,
      payload: true,
      audioAssets: {
        where: { voice },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: { status: true, contentVersion: true, audioParts: true },
      },
    },
  });

  let queued = 0;
  let skipped = 0;

  for (const lesson of lessons) {
    const text = extractAudioText(lesson.payload);
    if (!text) {
      skipped++;
      continue;
    }

    const existing = lesson.audioAssets[0];
    if (
      existing?.status === "GENERATED" &&
      existing.contentVersion === lesson.version &&
      isLessonAudioIntegrityCurrent(existing.audioParts, text)
    ) {
      skipped++;
      continue;
    }

    const estimatedCostUsd = estimateTtsCostUsd(text);
    await prisma.lessonAudio.upsert({
      where: {
        lessonId_contentVersion_voice: {
          lessonId: lesson.contentId,
          contentVersion: lesson.version,
          voice,
        },
      },
      update: { status: "PENDING", estimatedCostUsd },
      create: {
        lessonId: lesson.contentId,
        contentVersion: lesson.version,
        voice,
        status: "PENDING",
        estimatedCostUsd,
      },
    });
    queued++;
  }

  return { queued, skipped, total: lessons.length };
}

export async function claimNextAudioJobs(input: {
  limit: number;
}): Promise<Array<{ id: string; lessonId: string; voice: string; contentVersion: string; estimatedCostUsd: number }>> {
  if (isTtsGenerationStopped()) return [];
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, input.limit));

  const pending = await prisma.lessonAudio.findMany({
    where: { status: "PENDING" },
    orderBy: { generatedAt: "asc" },
    take: limit,
    select: { id: true, lessonId: true, voice: true, contentVersion: true, estimatedCostUsd: true },
  });

  if (pending.length === 0) return [];

  const claimed = [];
  const claimedAt = new Date();
  for (const job of pending) {
    const result = await prisma.lessonAudio.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", generatedAt: claimedAt },
    });
    if (result.count === 1) claimed.push(job);
  }

  return claimed;
}

export async function releaseClaimedAudioJobs(jobIds: string[]) {
  if (jobIds.length === 0) return { count: 0 };
  return prisma.lessonAudio.updateMany({
    where: { id: { in: jobIds }, status: "PROCESSING" },
    data: { status: "PENDING" },
  });
}

export async function processAudioJob(jobId: string): Promise<ProcessResult> {
  const row = await prisma.lessonAudio.findUnique({
    where: { id: jobId },
    include: {
      lesson: { select: { contentId: true, version: true, grade: true, subject: true, payload: true } },
    },
  });

  if (!row) return { jobId, lessonId: "", status: "FAILED", error: "Job not found." };

  const text = extractAudioText(row.lesson.payload);
  if (!text) {
    await prisma.lessonAudio.update({ where: { id: jobId }, data: { status: "FAILED" } });
    await notifyGradeOrchestrator({
      grade: row.lesson.grade,
      subject: row.lesson.subject,
      errorMessage: "Lesson has no readable text.",
    });
    return { jobId, lessonId: row.lessonId, status: "FAILED", error: "Lesson has no readable text." };
  }

  const queuedIntegrity = readLessonAudioIntegrityFromParts(row.audioParts);
  if (
    row.contentVersion !== row.lesson.version ||
    (queuedIntegrity && queuedIntegrity.sourceTextHash !== sha256Text(text))
  ) {
    await prisma.lessonAudio.update({ where: { id: jobId }, data: { status: "STALE" } });
    return { jobId, lessonId: row.lessonId, status: "STALE", error: "Lesson version or narration source changed." };
  }

  try {
    const result = await generateLessonAudioNow({
      lessonId: row.lessonId,
      contentVersion: row.contentVersion,
      voice: row.voice,
      text,
      grade: row.lesson.grade,
      subject: row.lesson.subject,
    });
    await notifyGradeOrchestrator({
      grade: row.lesson.grade,
      subject: row.lesson.subject,
    });
    return {
      jobId,
      lessonId: row.lessonId,
      status: "GENERATED",
      url: result.storageUrl ?? undefined,
    };
  } catch (error: any) {
    const message = error?.message ?? "Audio generation failed.";
    await prisma.lessonAudio.update({ where: { id: jobId }, data: { status: "FAILED" } }).catch(() => {});
    await notifyGradeOrchestrator({
      grade: row.lesson.grade,
      subject: row.lesson.subject,
      errorMessage: message,
    });
    return { jobId, lessonId: row.lessonId, status: "FAILED", error: message };
  }
}

export async function retryFailedJobs(
  input: { grade?: number; subject?: string; limit?: number } = {}
): Promise<{ retried: number }> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));

  const where: Prisma.LessonAudioWhereInput = {
    status: "FAILED",
    ...(input.grade || input.subject
      ? {
          lesson: {
            ...(input.grade ? { grade: input.grade } : {}),
            ...(input.subject ? { subject: input.subject.trim().toUpperCase() } : {}),
          },
        }
      : {}),
  };

  const failed = await prisma.lessonAudio.findMany({ where, take: limit, select: { id: true } });
  if (failed.length === 0) return { retried: 0 };

  await prisma.lessonAudio.updateMany({
    where: { id: { in: failed.map((r) => r.id) } },
    data: { status: "PENDING" },
  });

  return { retried: failed.length };
}

export async function getAudioQueueStatus(
  input: { grade?: number; subject?: string } = {}
): Promise<QueueStatus> {
  const lessonFilter: Prisma.LessonAudioWhereInput =
    input.grade || input.subject
      ? {
          lesson: {
            ...(input.grade ? { grade: input.grade } : {}),
            ...(input.subject ? { subject: input.subject.trim().toUpperCase() } : {}),
          },
        }
      : {};

  const [pending, processing, generated, failed, lastRow, costAgg] = await Promise.all([
    prisma.lessonAudio.count({ where: { status: "PENDING", ...lessonFilter } }),
    prisma.lessonAudio.count({ where: { status: "PROCESSING", ...lessonFilter } }),
    prisma.lessonAudio.count({ where: { status: "GENERATED", ...lessonFilter } }),
    prisma.lessonAudio.count({ where: { status: "FAILED", ...lessonFilter } }),
    prisma.lessonAudio.findFirst({
      where: { status: "GENERATED", ...lessonFilter },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true },
    }),
    prisma.lessonAudio.aggregate({
      where: { status: "GENERATED", ...lessonFilter },
      _sum: { estimatedCostUsd: true },
    }),
  ]);

  return {
    pending,
    processing,
    generated,
    failed,
    lastProcessed: lastRow?.generatedAt?.toISOString() ?? null,
    totalCostUsd: Number((costAgg._sum.estimatedCostUsd ?? 0).toFixed(6)),
  };
}
