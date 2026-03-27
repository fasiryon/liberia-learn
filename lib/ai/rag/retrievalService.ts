import { Prisma } from "@prisma/client";
import { embedText, toVectorLiteral } from "@/lib/ai/rag/embeddingService";
import { prisma } from "@/lib/db";

export type RelevantLesson = {
  id: string;
  title: string;
  content: string;
  subject: string;
  gradeLevel: number;
  similarity: number;
};

export type RetrievedChunk = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  chunkIndex: number;
  subject: string | null;
  grade: number | null;
  schoolId: string | null;
  scope: string;
  sourceLabel: string | null;
  similarity: number;
  rankingScore: number;
  metadata?: unknown;
};

export type RetrievalMode = "classroom" | "policy" | "mixed";
export type RetrievalContextMode =
  | "governance"
  | "lesson"
  | "homework"
  | "learning"
  | "support"
  | "mixed";
export type RetrievalContext = {
  role?: "ADMIN" | "TEACHER" | "STUDENT" | "GUARDIAN" | "MOE_OFFICIAL";
  mode?: RetrievalContextMode;
  subject?: string | null;
  gradeLevel?: string | null;
};

type LessonRetrievalRow = {
  id: string;
  title: string | null;
  content: string | null;
  subject: string;
  gradeLevel: number;
  similarity: number;
};

type ChunkRetrievalRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  chunkIndex: number;
  subject: string | null;
  grade: number | null;
  schoolId: string | null;
  scope: string;
  sourceLabel: string | null;
  similarity: number;
  metadata: unknown;
};

type ChunkQueryInput = {
  question: string;
  schoolId: string;
  userId?: string;
  subject?: string | null;
  grade?: number | null;
  allowedSubjects?: string[] | null;
  allowedGrades?: number[] | null;
  limit?: number;
  topK?: number;
  sourceTypes?: string[];
  mode?: RetrievalMode;
  context?: RetrievalContext;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeSubject(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseGradeLevel(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractChunkKind(chunk: {
  sourceType: string;
  sourceLabel: string | null;
  title: string;
  metadata?: unknown;
}): string {
  const metadata = normalizeMetadata(chunk.metadata);
  const kindFields = [
    metadata.kind,
    metadata.contentType,
    metadata.sourceKind,
    metadata.documentType,
    chunk.sourceType,
    chunk.sourceLabel,
    chunk.title,
  ];
  const combined = kindFields.map(normalizeText).filter(Boolean).join(" ");

  if (/(curriculum|lesson_content|curriculum_content)/.test(combined)) {
    return "curriculum";
  }

  if (/(lesson|assignment|homework)/.test(combined)) {
    return "lesson";
  }

  if (/(standard|moe standard|standards)/.test(combined)) {
    return "standard";
  }

  if (/(governance|policy|adr|audit|compliance)/.test(combined)) {
    return "governance";
  }

  return "generic";
}

function extractChunkSubject(chunk: {
  subject: string | null;
  metadata?: unknown;
}): string {
  const metadata = normalizeMetadata(chunk.metadata);
  return (
    normalizeSubject(chunk.subject) ||
    normalizeSubject(metadata.subject) ||
    normalizeSubject(metadata.subjectCode) ||
    normalizeSubject(metadata.subjectName)
  );
}

function extractChunkGradeLevel(chunk: {
  grade: number | null;
  metadata?: unknown;
}): number | null {
  const metadata = normalizeMetadata(chunk.metadata);
  return (
    (typeof chunk.grade === "number" ? chunk.grade : null) ??
    parseGradeLevel(metadata.gradeLevel) ??
    parseGradeLevel(metadata.grade) ??
    parseGradeLevel(metadata.gradeBand)
  );
}

function computeContentPriorityBoost(
  kind: string,
  contextMode: RetrievalContextMode
): number {
  const isGovernanceContext = contextMode === "governance";
  const isLearningContext = ["lesson", "homework", "learning", "support"].includes(
    contextMode
  );

  if (kind === "curriculum") {
    return isLearningContext ? 0.32 : isGovernanceContext ? 0.04 : 0.24;
  }

  if (kind === "lesson") {
    return isLearningContext ? 0.24 : isGovernanceContext ? 0.05 : 0.18;
  }

  if (kind === "standard") {
    return isGovernanceContext ? 0.18 : 0.12;
  }

  if (kind === "governance") {
    return isGovernanceContext ? 0.3 : 0.02;
  }

  return 0.04;
}

function computeMetadataMatchBoost(
  chunk: RetrievedChunk,
  context: RetrievalContext | undefined
): number {
  if (!context) {
    return 0;
  }

  let boost = 0;
  const expectedSubject = normalizeSubject(context.subject);
  const chunkSubject = extractChunkSubject(chunk);
  if (expectedSubject && chunkSubject) {
    boost += expectedSubject === chunkSubject ? 0.18 : chunkSubject.includes(expectedSubject) ? 0.08 : 0;
  }

  const expectedGrade = parseGradeLevel(context.gradeLevel);
  const chunkGrade = extractChunkGradeLevel(chunk);
  if (expectedGrade != null && chunkGrade != null) {
    boost += expectedGrade === chunkGrade ? 0.16 : Math.abs(expectedGrade - chunkGrade) === 1 ? 0.06 : 0;
  }

  return boost;
}

function computeIntentBoost(
  question: string,
  kind: string,
  contextMode: RetrievalContextMode
): number {
  const loweredQuestion = question.toLowerCase();

  if (
    (contextMode === "governance" ||
      /(policy|governance|audit|adr|compliance|moe)/.test(loweredQuestion)) &&
    kind === "governance"
  ) {
    return 0.08;
  }

  if (
    (["lesson", "homework", "learning", "support"].includes(contextMode) ||
      /(lesson|explain|teach|homework|assignment|student|topic|understand)/.test(
        loweredQuestion
      )) &&
    (kind === "curriculum" || kind === "lesson")
  ) {
    return 0.08;
  }

  if (/(standard|objective|benchmark)/.test(loweredQuestion) && kind === "standard") {
    return 0.06;
  }

  return 0;
}

function rerankChunks(
  chunks: RetrievedChunk[],
  question: string,
  context?: RetrievalContext
): RetrievedChunk[] {
  const contextMode = context?.mode ?? "mixed";

  return [...chunks]
    .map((chunk) => {
      const kind = extractChunkKind(chunk);
      const rankingScore =
        chunk.similarity +
        computeContentPriorityBoost(kind, contextMode) +
        computeMetadataMatchBoost(chunk, context) +
        computeIntentBoost(question, kind, contextMode);

      return {
        ...chunk,
        rankingScore,
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore);
}

function buildVectorSql(vector: number[]): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(`'${toVectorLiteral(vector)}'::vector`)}`;
}

export async function retrieveRelevantLessons(
  question: string,
  studentId: string,
  limit = 3
): Promise<RelevantLesson[]> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return [];
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      currentGrade: true,
      enrollments: {
        select: {
          Class: {
            select: {
              subject: true,
            },
          },
        },
      },
    },
  });

  if (!student?.currentGrade) {
    return [];
  }

  const enrolledSubjects = Array.from(
    new Set(
      student.enrollments
        .map((enrollment) => enrollment.Class.subject)
        .filter(Boolean)
    )
  );

  const questionEmbedding = await embedText(trimmedQuestion);
  const vectorSql = buildVectorSql(questionEmbedding);
  const subjectFilter = enrolledSubjects.length
    ? Prisma.sql`AND "subject" IN (${Prisma.join(enrolledSubjects)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<LessonRetrievalRow[]>(
    Prisma.sql`
      SELECT
        "id",
        COALESCE("payload"->>'title', "contentId") AS "title",
        COALESCE("payload"->>'body', "payload"->>'content', '') AS "content",
        "subject",
        "grade" AS "gradeLevel",
        1 - ("embedding" <=> ${vectorSql}) AS "similarity"
      FROM "CurriculumContent"
      WHERE "grade" = ${student.currentGrade}
        AND "status" = 'published'
        AND "contentType" = 'lesson'
        AND "embedding" IS NOT NULL
        ${subjectFilter}
      ORDER BY "embedding" <=> ${vectorSql}
      LIMIT ${Math.max(1, limit)}
    `
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? "Untitled lesson",
    content: row.content ?? "",
    subject: row.subject,
    gradeLevel: Number(row.gradeLevel),
    similarity: Number(row.similarity),
  }));
}

export async function retrieveRelevantChunks(
  input: ChunkQueryInput
): Promise<RetrievedChunk[]> {
  const trimmedQuestion = input.question.trim();
  if (!trimmedQuestion || !input.schoolId) {
    return [];
  }

  const questionEmbedding = await embedText(trimmedQuestion);
  const vectorSql = buildVectorSql(questionEmbedding);
  const effectiveLimit = Math.max(1, Math.min(input.topK ?? input.limit ?? 5, 8));
  const rawLimit = Math.max(effectiveLimit * 3, 12);
  const mode = input.mode ?? "mixed";
  const allowedSubjects = Array.from(
    new Set((input.allowedSubjects ?? []).map((subject) => subject.trim()).filter(Boolean))
  );
  const allowedGrades = Array.from(
    new Set(
      (input.allowedGrades ?? []).filter(
        (grade): grade is number => typeof grade === "number" && Number.isFinite(grade)
      )
    )
  );
  const requestedSourceTypes =
    input.sourceTypes && input.sourceTypes.length > 0
      ? input.sourceTypes
      : mode === "classroom"
        ? ["curriculum_content"]
        : mode === "policy"
          ? ["policy_document"]
          : ["curriculum_content", "policy_document"];
  const sourceTypeFilter = Prisma.sql`AND "sourceType" IN (${Prisma.join(requestedSourceTypes)})`;
  const allowedSubjectFilter = allowedSubjects.length
    ? Prisma.sql`AND "subject" IN (${Prisma.join(allowedSubjects)})`
    : Prisma.empty;
  const allowedGradeFilter = allowedGrades.length
    ? Prisma.sql`AND "grade" IN (${Prisma.join(allowedGrades)})`
    : Prisma.empty;
  const subjectFilter =
    input.subject && input.subject.trim()
      ? mode === "classroom"
        ? Prisma.sql`AND "subject" = ${input.subject.trim()}`
        : Prisma.sql`AND ("subject" = ${input.subject.trim()} OR "subject" IS NULL)`
      : Prisma.empty;
  const gradeFilter =
    typeof input.grade === "number"
      ? mode === "classroom"
        ? Prisma.sql`AND "grade" = ${input.grade}`
        : Prisma.sql`AND ("grade" = ${input.grade} OR "grade" IS NULL)`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<ChunkRetrievalRow[]>(
    Prisma.sql`
      SELECT
        "id",
        "sourceType",
        "sourceId",
        "title",
        "content",
        "chunkIndex",
        "subject",
        "grade",
        "schoolId",
        "scope",
        "sourceLabel",
        "metadata",
        1 - ("embedding" <=> ${vectorSql}) AS "similarity"
      FROM "RagChunk"
      WHERE "embedding" IS NOT NULL
        AND ("scope" = 'GLOBAL' OR "schoolId" = ${input.schoolId})
        ${allowedSubjectFilter}
        ${allowedGradeFilter}
        ${subjectFilter}
        ${gradeFilter}
        ${sourceTypeFilter}
      ORDER BY "embedding" <=> ${vectorSql}
      LIMIT ${rawLimit}
    `
  );

  const rankedChunks = rerankChunks(
    rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    content: row.content,
    chunkIndex: Number(row.chunkIndex),
    subject: row.subject,
    grade: row.grade == null ? null : Number(row.grade),
    schoolId: row.schoolId,
    scope: row.scope,
    sourceLabel: row.sourceLabel,
    similarity: Number(row.similarity),
    rankingScore: Number(row.similarity),
    metadata: row.metadata,
  })),
    trimmedQuestion,
    input.context
  );

  return rankedChunks.slice(0, effectiveLimit);
}
