/**
 * lib/ai/rag/sparseRetrieval.ts
 *
 * BM25 sparse retrieval using PostgreSQL full-text search.
 * Reuses the GIN index added in Sprint 14:
 *   ON "CurriculumContent" USING gin(
 *     to_tsvector('english', coalesce(title,'') || ' ' || coalesce(subject,''))
 *   )
 *
 * Note: CurriculumContent has no schoolId column; content is global/curriculum-scoped.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RetrievedChunk } from "@/lib/ai/rag/retrievalService";

export type SparseRetrievalFilters = {
  /** Filter to a specific subject (normalized to UPPERCASE). */
  subject?: string | null;
  /** Filter to a specific grade level. */
  gradeLevel?: number | null;
  /**
   * Not applied — CurriculumContent has no schoolId column.
   * Accepted for API symmetry with the hybrid retriever signature.
   */
  schoolId?: string | null;
};

type SparseRow = {
  id: string;
  contentId: string;
  title: string | null;
  content: string;
  subject: string;
  grade: number;
  bm25Score: number;
};

function normalizeSubject(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/**
 * Keyword-based (BM25) sparse retrieval over approved CurriculumContent.
 *
 * Uses ts_rank + plainto_tsquery against the Sprint-14 GIN index so no schema
 * changes are required.  Results are returned as RetrievedChunk objects with
 * `similarity` and `rankingScore` set to the ts_rank BM25 score.
 *
 * @param query   The user question (plain text, not pre-tokenised).
 * @param filters Optional subject / gradeLevel filters.
 * @param topK    Maximum number of results to return (default 10).
 */
export async function sparseRetrieve(
  query: string,
  filters: SparseRetrievalFilters = {},
  topK: number = 10
): Promise<RetrievedChunk[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedSubject = filters.subject ? normalizeSubject(filters.subject) : null;
  const gradeLevel = filters.gradeLevel ?? null;

  const subjectFilter = normalizedSubject
    ? Prisma.sql`AND "subject" = ${normalizedSubject}`
    : Prisma.empty;

  const gradeFilter =
    gradeLevel != null ? Prisma.sql`AND "grade" = ${gradeLevel}` : Prisma.empty;

  let rows: SparseRow[];
  try {
    rows = await prisma.$queryRaw<SparseRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "contentId",
          COALESCE("payload"->>'title', "title", "contentId") AS "title",
          COALESCE("payload"->>'body', "payload"->>'content', '')  AS "content",
          "subject",
          "grade",
          ts_rank(
            to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("subject", '')),
            plainto_tsquery('english', ${trimmedQuery})
          ) AS "bm25Score"
        FROM "CurriculumContent"
        WHERE
          "status" IN ('published', 'APPROVED')
          AND to_tsvector('english', COALESCE("title", '') || ' ' || COALESCE("subject", ''))
            @@ plainto_tsquery('english', ${trimmedQuery})
          ${subjectFilter}
          ${gradeFilter}
        ORDER BY "bm25Score" DESC
        LIMIT ${Math.max(1, topK)}
      `
    );
  } catch (error) {
    console.error("[RAG_SPARSE] Full-text search query failed — returning empty results", {
      error,
    });
    return [];
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return rows.map((row) => ({
    id: String(row.id),
    sourceType: "curriculum_content",
    sourceId: String(row.contentId),
    title: row.title ? String(row.title) : "Untitled",
    content: row.content ? String(row.content) : "",
    chunkIndex: 0,
    subject: String(row.subject),
    grade: row.grade != null ? Number(row.grade) : null,
    schoolId: null,
    scope: "GLOBAL",
    sourceLabel: String(row.contentId),
    similarity: Number(row.bm25Score),
    rankingScore: Number(row.bm25Score),
    retrievalTier: "default" as const,
    metadata: { kind: "curriculum", retrievalMethod: "bm25" },
  }));
}
