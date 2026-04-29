import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { compileTextbook, type TextbookFormat } from "@/lib/ai/textbook/textbookCompiler";
import { renderTextbookPdfStream } from "@/lib/ai/textbook/textbookPdf";
import { lessonPdfSupabasePath, uploadLessonPdfToSupabase } from "@/lib/supabaseStorage";

const DEFAULT_BATCH_SIZE = 2;
const MAX_BATCH_SIZE = 2;
const DEFAULT_VERSION = "v1";
const ESTIMATED_TEXTBOOK_COST_USD = 0;

export type EnqueueTextbookInput = {
  grade: number;
  subject: string;
  format?: TextbookFormat;
  version?: string;
  requestedById?: string;
  force?: boolean;
};

export type TextbookQueueStatus = {
  pending: number;
  processing: number;
  generated: number;
  failed: number;
  lastProcessed: string | null;
  estimatedCostUsd: number;
};

export type TextbookJob = {
  id: string;
  grade: number;
  subject: string;
  format: string;
  version: string;
  force: boolean;
  storageUrl: string | null;
  estimatedCostUsd: number;
};

function normalizeFormat(format?: string): TextbookFormat {
  const value = (format ?? "student").trim().toLowerCase();
  if (value === "teacher" || value === "workbook" || value === "assessment") return value;
  return "student";
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function enqueueTextbook(input: EnqueueTextbookInput) {
  const grade = Number(input.grade);
  const subject = input.subject.trim().toUpperCase();
  const format = normalizeFormat(input.format);
  const version = input.version?.trim() || DEFAULT_VERSION;

  if (!Number.isFinite(grade) || grade < 1 || !subject) {
    throw Object.assign(new Error("grade and subject are required."), { status: 400 });
  }

  const existing = await prisma.textbookGenerationJob.findUnique({
    where: { grade_subject_format_version: { grade, subject, format, version } },
    select: { id: true, status: true, storageUrl: true },
  });

  if (existing?.status === "GENERATED" && existing.storageUrl && !input.force) {
    return { queued: 0, skipped: 1, jobId: existing.id, status: existing.status };
  }

  const job = await prisma.textbookGenerationJob.upsert({
    where: { grade_subject_format_version: { grade, subject, format, version } },
    update: {
      status: "PENDING",
      errorMessage: null,
      force: Boolean(input.force),
      requestedById: input.requestedById,
      estimatedCostUsd: ESTIMATED_TEXTBOOK_COST_USD,
    },
    create: {
      grade,
      subject,
      format,
      version,
      status: "PENDING",
      force: Boolean(input.force),
      requestedById: input.requestedById,
      estimatedCostUsd: ESTIMATED_TEXTBOOK_COST_USD,
    },
    select: { id: true, status: true },
  });

  return { queued: 1, skipped: 0, jobId: job.id, status: job.status };
}

export async function claimNextTextbookJobs(input: { limit?: number } = {}): Promise<TextbookJob[]> {
  const limit = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(input.limit ?? DEFAULT_BATCH_SIZE)));
  const pending = await prisma.textbookGenerationJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, grade: true, subject: true, format: true, version: true, force: true, storageUrl: true, estimatedCostUsd: true },
  });

  if (pending.length === 0) return [];

  const claimed: TextbookJob[] = [];
  const claimedAt = new Date();
  for (const job of pending) {
    const result = await prisma.textbookGenerationJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", claimedAt, attempts: { increment: 1 } },
    });
    if (result.count === 1) claimed.push(job);
  }

  return claimed;
}

export async function releaseClaimedTextbookJobs(jobIds: string[]) {
  if (jobIds.length === 0) return { count: 0 };
  return prisma.textbookGenerationJob.updateMany({
    where: { id: { in: jobIds }, status: "PROCESSING" },
    data: { status: "PENDING" },
  });
}

export async function markGenerated(input: {
  id: string;
  storageUrl: string;
  storagePath: string;
  durationMs: number;
  estimatedCostUsd?: number;
}) {
  return prisma.textbookGenerationJob.update({
    where: { id: input.id },
    data: {
      status: "GENERATED",
      storageUrl: input.storageUrl,
      storagePath: input.storagePath,
      durationMs: input.durationMs,
      estimatedCostUsd: input.estimatedCostUsd ?? ESTIMATED_TEXTBOOK_COST_USD,
      errorMessage: null,
      generatedAt: new Date(),
    },
  });
}

export async function markFailed(id: string, errorMessage: string) {
  return prisma.textbookGenerationJob.update({
    where: { id },
    data: { status: "FAILED", errorMessage: errorMessage.slice(0, 2000) },
  });
}

export async function processTextbookJob(job: TextbookJob | string) {
  const row =
    typeof job === "string"
      ? await prisma.textbookGenerationJob.findUnique({ where: { id: job } })
      : await prisma.textbookGenerationJob.findUnique({ where: { id: job.id } });

  if (!row) return { jobId: typeof job === "string" ? job : job.id, status: "FAILED", error: "Job not found." };
  if (row.status === "GENERATED" && row.storageUrl && !row.force) {
    return { jobId: row.id, status: "GENERATED", url: row.storageUrl, skipped: true };
  }

  const startedAt = Date.now();
  try {
    const format = normalizeFormat(row.format);
    const result = await compileTextbook({ subject: row.subject, gradeLevel: row.grade, format });
    const stream = await renderTextbookPdfStream(result);
    const pdfBuffer = await streamToBuffer(stream);
    const storagePath = lessonPdfSupabasePath({
      grade: row.grade,
      subject: row.subject,
      format,
      version: row.version,
    });
    const storageUrl = await uploadLessonPdfToSupabase(pdfBuffer, storagePath);
    const durationMs = Date.now() - startedAt;

    await markGenerated({ id: row.id, storageUrl, storagePath, durationMs });
    console.info("textbook_generation_generated", {
      jobId: row.id,
      grade: row.grade,
      subject: row.subject,
      format,
      durationMs,
      estimatedCostUsd: ESTIMATED_TEXTBOOK_COST_USD,
    });
    return { jobId: row.id, status: "GENERATED", url: storageUrl, durationMs };
  } catch (error: any) {
    const message = error?.message ?? "Textbook generation failed.";
    await markFailed(row.id, message).catch(() => {});
    console.warn("textbook_generation_failed", { jobId: row.id, error: message });
    return { jobId: row.id, status: "FAILED", error: message };
  }
}

export async function retryFailed(input: { grade?: number; subject?: string; format?: string; limit?: number } = {}) {
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
  const where: Prisma.TextbookGenerationJobWhereInput = {
    status: "FAILED",
    ...(input.grade ? { grade: input.grade } : {}),
    ...(input.subject ? { subject: input.subject.trim().toUpperCase() } : {}),
    ...(input.format ? { format: normalizeFormat(input.format) } : {}),
  };
  const failed = await prisma.textbookGenerationJob.findMany({ where, take: limit, select: { id: true } });
  if (failed.length === 0) return { retried: 0 };

  await prisma.textbookGenerationJob.updateMany({
    where: { id: { in: failed.map((job) => job.id) } },
    data: { status: "PENDING", errorMessage: null },
  });
  return { retried: failed.length };
}

export async function getTextbookQueueStatus(input: { grade?: number; subject?: string; format?: string } = {}): Promise<TextbookQueueStatus> {
  const where: Prisma.TextbookGenerationJobWhereInput = {
    ...(input.grade ? { grade: input.grade } : {}),
    ...(input.subject ? { subject: input.subject.trim().toUpperCase() } : {}),
    ...(input.format ? { format: normalizeFormat(input.format) } : {}),
  };
  const [pending, processing, generated, failed, lastRow, costAgg] = await Promise.all([
    prisma.textbookGenerationJob.count({ where: { ...where, status: "PENDING" } }),
    prisma.textbookGenerationJob.count({ where: { ...where, status: "PROCESSING" } }),
    prisma.textbookGenerationJob.count({ where: { ...where, status: "GENERATED" } }),
    prisma.textbookGenerationJob.count({ where: { ...where, status: "FAILED" } }),
    prisma.textbookGenerationJob.findFirst({
      where: { ...where, status: "GENERATED" },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true },
    }),
    prisma.textbookGenerationJob.aggregate({
      where: { ...where, status: { in: ["PENDING", "PROCESSING", "GENERATED"] } },
      _sum: { estimatedCostUsd: true },
    }),
  ]);

  return {
    pending,
    processing,
    generated,
    failed,
    lastProcessed: lastRow?.generatedAt?.toISOString() ?? null,
    estimatedCostUsd: Number((costAgg._sum.estimatedCostUsd ?? 0).toFixed(6)),
  };
}
