import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { chunkText } from "@/lib/ai/rag/chunking";
import { getCurriculumBody, getLessonEmbeddingSource, toVectorLiteral } from "@/lib/ai/rag/embeddingService";
import { routedEmbedding } from "@/lib/ai/routedCompletion";
import { listPolicySources, loadPolicySourceText } from "@/lib/ai/rag/policyCatalog";
import { buildCurriculumChunkSeeds } from "@/lib/ai/rag/curriculumChunkBlueprint";

type Scope = "GLOBAL" | "SCHOOL";

function isPublishedCurriculumStatus(status: string | null | undefined): boolean {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  return normalized === "published" || normalized === "approved" || normalized === "accepted";
}

type ChunkSeed = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  chunkIndex: number;
  subject?: string | null;
  grade?: number | null;
  schoolId?: string | null;
  scope: Scope;
  sourceLabel?: string | null;
  metadata?: Prisma.JsonValue;
};

function buildChunkRows(seed: Omit<ChunkSeed, "id" | "chunkIndex" | "content"> & { content: string }): ChunkSeed[] {
  return chunkText(seed.content)
    .map((chunk) => chunk.toWellFormed().replace(/\u0000/g, "").trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk, index) => ({
      ...seed,
      id: randomUUID(),
      chunkIndex: index,
      content: chunk,
    }));
}

async function writeChunkEmbeddings(chunks: ChunkSeed[]) {
  for (const chunk of chunks) {
    const content = chunk.content.toWellFormed().replace(/\u0000/g, "").trim();
    if (!content) {
      console.warn("[RAG_EMBED] Skipping empty chunk content", {
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        chunkIndex: chunk.chunkIndex,
      });
      continue;
    }

    const result = await routedEmbedding({
      input: content,
    });
    if (!Array.isArray(result.embedding)) {
      throw new Error("Embedding response was not a vector");
    }
    const vectorSql = Prisma.raw(`'${toVectorLiteral(result.embedding)}'::vector`);

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "RagChunk"
        SET "embedding" = ${vectorSql},
            "embeddedAt" = NOW()
        WHERE "id" = ${chunk.id}
      `
    );
  }
}

async function replaceChunksForSource(sourceType: string, sourceId: string, chunks: ChunkSeed[]) {
  const normalizedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.ragChunk.deleteMany({
      where: { sourceType, sourceId },
    });

    if (normalizedChunks.length === 0) {
      return;
    }

    await tx.ragChunk.createMany({
      data: normalizedChunks.map((chunk) => ({
        id: chunk.id,
        sourceType: chunk.sourceType,
        sourceId: chunk.sourceId,
        title: chunk.title,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        subject: chunk.subject ?? null,
        grade: chunk.grade ?? null,
        schoolId: chunk.schoolId ?? null,
        scope: chunk.scope,
        sourceLabel: chunk.sourceLabel ?? null,
        metadata: chunk.metadata ?? Prisma.JsonNull,
      })),
    });
  });

  if (normalizedChunks.length > 0) {
    await writeChunkEmbeddings(normalizedChunks);
  }
}

async function resolveContentScope(record: {
  payload: Prisma.JsonValue;
}): Promise<{ scope: Scope; schoolId: string | null }> {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const createdByUserId =
    typeof payload.createdByUserId === "string" ? payload.createdByUserId : null;

  if (!createdByUserId) {
    return { scope: "GLOBAL", schoolId: null };
  }

  const creator = await prisma.user.findUnique({
    where: { id: createdByUserId },
    select: { schoolId: true },
  });

  if (!creator?.schoolId) {
    return { scope: "GLOBAL", schoolId: null };
  }

  return { scope: "SCHOOL", schoolId: creator.schoolId };
}

export async function syncCurriculumContentRagChunks(curriculumContentId: string): Promise<void> {
  const record = await prisma.curriculumContent.findUnique({
    where: { id: curriculumContentId },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      status: true,
      payload: true,
      teacherCreated: true,
    },
  });

  if (!record) {
    throw new Error(`CurriculumContent ${curriculumContentId} not found`);
  }

  if (!isPublishedCurriculumStatus(record.status)) {
    await prisma.ragChunk.deleteMany({
      where: {
        sourceType: "curriculum_content",
        sourceId: record.id,
      },
    });
    return;
  }

  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : record.contentId;
  const baseBody = getCurriculumBody(payload);
  const objectives = Array.isArray(payload.objectives)
    ? payload.objectives.filter((item): item is string => typeof item === "string")
    : [];
  const activities = Array.isArray(payload.activities)
    ? payload.activities.filter((item): item is string => typeof item === "string")
    : [];

  const scopeInfo = await resolveContentScope(record);
  const structuredSeeds = buildCurriculumChunkSeeds({
    sourceId: record.id,
    sourceLabel: record.contentId,
    payload,
    subject: record.subject,
    grade: record.grade,
    schoolId: scopeInfo.schoolId,
    scope: scopeInfo.scope,
  });

  const chunks = (structuredSeeds.length > 0 ? structuredSeeds : [{
    sourceType: "curriculum_content",
    sourceId: record.id,
    title,
    content: [title, baseBody, objectives.join("\n"), activities.join("\n")].filter(Boolean).join("\n\n"),
    subject: record.subject,
    grade: record.grade,
    schoolId: scopeInfo.schoolId,
    scope: scopeInfo.scope,
    sourceLabel: record.contentId,
    metadata: {
      contentId: record.contentId,
      teacherCreated: record.teacherCreated,
    },
  }]).flatMap((seed) =>
    buildChunkRows({
      ...seed,
      metadata: {
        contentId: record.contentId,
        teacherCreated: record.teacherCreated,
        ...((seed.metadata as Record<string, unknown> | null) ?? {}),
      },
    })
  );

  await replaceChunksForSource("curriculum_content", record.id, chunks);
}

export async function syncPolicyRagChunks(): Promise<number> {
  let count = 0;

  for (const policy of listPolicySources()) {
    const raw = await loadPolicySourceText(policy.relativePath);
    const chunks = buildChunkRows({
      sourceType: "policy_document",
      sourceId: policy.sourceId,
      title: policy.sourceLabel,
      content: raw,
      subject: policy.subject ?? null,
      grade: policy.grade ?? null,
      schoolId: null,
      scope: "GLOBAL",
      sourceLabel: policy.relativePath,
      metadata: {
        relativePath: policy.relativePath,
      },
    });
    await replaceChunksForSource("policy_document", policy.sourceId, chunks);
    count += chunks.length;
  }

  return count;
}

export async function syncPublishedCurriculumRagChunks(): Promise<number> {
  const records = await prisma.curriculumContent.findMany({
    where: {
      status: {
        in: ["published", "APPROVED", "approved", "accepted", "PUBLISHED"],
      },
    },
    select: { id: true },
  });

  for (const record of records) {
    await syncCurriculumContentRagChunks(record.id);
  }

  return records.length;
}

export async function deleteCurriculumContentRagChunks(
  curriculumContentId: string
): Promise<number> {
  const ragChunkModel = (prisma as any)?.ragChunk;
  const deleteMany = ragChunkModel?.deleteMany;

  if (typeof deleteMany !== "function") {
    return 0;
  }

  try {
    const result = await deleteMany.call(ragChunkModel, {
      where: {
        sourceType: "curriculum_content",
        sourceId: curriculumContentId,
      },
    });
    return typeof result?.count === "number" ? result.count : 0;
  } catch {
    return 0;
  }
}

export async function getCurriculumEmbeddingSource(curriculumContentId: string): Promise<string> {
  return getLessonEmbeddingSource(curriculumContentId);
}
