import { Prisma } from "@prisma/client";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { prisma } from "@/lib/db";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateInput(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS);
}

export function getCurriculumBody(payload: Record<string, unknown>): string {
  const direct =
    typeof payload.body === "string"
      ? payload.body
      : typeof payload.content === "string"
        ? payload.content
        : "";

  if (direct) return direct;

  if (typeof payload.lessonPlan === "string") {
    return payload.lessonPlan;
  }

  return JSON.stringify(payload);
}

export function buildLessonSource(record: {
  subject: string;
  payload: Prisma.JsonValue;
}): string {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "Untitled lesson";
  const content = getCurriculumBody(payload);

  return truncateInput([title, content, record.subject].join("\n"));
}

export function toVectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dimension embedding, received ${vector.length}`
    );
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding contains non-finite values");
    }
  }

  return `[${vector.join(",")}]`;
}

export async function getLessonEmbeddingSource(lessonId: string): Promise<string> {
  const lesson = await prisma.curriculumContent.findUnique({
    where: { id: lessonId },
    select: {
      subject: true,
      payload: true,
    },
  });

  if (!lesson) {
    throw new Error(`CurriculumContent ${lessonId} not found`);
  }

  return buildLessonSource(lesson);
}

export async function saveLessonEmbedding(lessonId: string, embedding: number[]): Promise<void> {
  const vectorSql = Prisma.raw(`'${toVectorLiteral(embedding)}'::vector`);

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "CurriculumContent"
      SET "embedding" = ${vectorSql},
          "embeddedAt" = NOW()
      WHERE "id" = ${lessonId}
    `
  );
}

export async function embedText(text: string): Promise<number[]> {
  const input = truncateInput(text);

  if (!input) {
    throw new Error("Cannot embed empty text");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await routedCompletion({
        mode: "embedding",
        model: EMBEDDING_MODEL,
        input,
      });
      const vector = response.embedding;

      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimension ${vector.length} for ${EMBEDDING_MODEL}`
        );
      }

      return vector;
    } catch (error: any) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = status === 429 || status >= 500 || status === 0;

      if (!retryable || attempt === MAX_RETRIES) {
        console.error("[RAG_EMBED] Embedding request failed", {
          attempt,
          status,
          message: error?.message ?? String(error),
        });
        throw error;
      }

      const backoffMs = attempt * 1000;
      console.warn("[RAG_EMBED] Retrying embedding request", {
        attempt,
        backoffMs,
        status,
      });
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Embedding request failed");
}

export async function embedLesson(lessonId: string): Promise<void> {
  const source = await getLessonEmbeddingSource(lessonId);
  const embedding = await embedText(source);
  await saveLessonEmbedding(lessonId, embedding);
}
