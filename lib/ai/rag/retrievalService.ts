import { Prisma } from "@prisma/client";
import {
  embedTextForCacheScope,
  toVectorLiteral,
} from "@/lib/ai/rag/embeddingService";
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
  retrievalTier?: "same_grade" | "nearby_grade" | "null_grade" | "default";
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

type ChunkQueryFilters = {
  sourceTypes: string[];
  allowedSubjects: string[];
  allowedGrades: number[];
  normalizedSubject: string;
  normalizedGrade: number | null;
};

type ClassroomFallbackTier = "same_grade" | "nearby_grade" | "null_grade" | "default";

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

function normalizeSubjectList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(normalizeSubject).filter(Boolean)));
}

function normalizeGradeList(values: Array<number | string | null | undefined>): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => parseGradeLevel(value))
        .filter((grade): grade is number => grade != null)
    )
  );
}

function expandNearbyGrades(grade: number | null): number[] {
  if (grade == null) {
    return [];
  }

  return Array.from(
    new Set(
      [grade - 2, grade - 1, grade, grade + 1, grade + 2].filter(
        (value) => value >= 1 && value <= 12
      )
    )
  );
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
    return isLearningContext ? 0.44 : isGovernanceContext ? 0.02 : 0.3;
  }

  if (kind === "lesson") {
    return isLearningContext ? 0.32 : isGovernanceContext ? 0.02 : 0.22;
  }

  if (kind === "standard") {
    return isGovernanceContext ? 0.18 : 0.1;
  }

  if (kind === "governance") {
    return isGovernanceContext ? 0.32 : -0.08;
  }

  return 0.04;
}

function computeMetadataMatchBoost(
  chunk: RetrievedChunk,
  context: RetrievalContext | undefined,
  hasExactGradeMatch: boolean
): number {
  if (!context) {
    return 0;
  }

  let boost = 0;
  const expectedSubject = normalizeSubject(context.subject);
  const chunkSubject = extractChunkSubject(chunk);
  if (expectedSubject && chunkSubject) {
    boost +=
      expectedSubject === chunkSubject
        ? 0.34
        : chunkSubject.includes(expectedSubject) || expectedSubject.includes(chunkSubject)
          ? 0.1
          : -0.22;
  } else if (expectedSubject && !chunkSubject) {
    boost -= 0.04;
  }

  const expectedGrade = parseGradeLevel(context.gradeLevel);
  const chunkGrade = extractChunkGradeLevel(chunk);
  if (expectedGrade != null && chunkGrade != null) {
    if (expectedGrade === chunkGrade) {
      boost += 0.46;
    } else if (hasExactGradeMatch) {
      boost -= Math.abs(expectedGrade - chunkGrade) <= 1 ? 0.42 : 0.52;
    } else {
      boost +=
        Math.abs(expectedGrade - chunkGrade) === 1
          ? 0.1
          : Math.abs(expectedGrade - chunkGrade) === 2
            ? 0.02
            : -0.18;
    }
  } else if (expectedGrade != null && chunkGrade == null) {
    boost -= hasExactGradeMatch ? 0.24 : 0.08;
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
  const expectedGrade = parseGradeLevel(context?.gradeLevel);
  const hasExactGradeMatch =
    expectedGrade != null &&
    chunks.some((chunk) => extractChunkGradeLevel(chunk) === expectedGrade);

  return [...chunks]
    .map((chunk) => {
      const kind = extractChunkKind(chunk);
      const rankingScore =
        chunk.similarity +
        computeContentPriorityBoost(kind, contextMode) +
        computeMetadataMatchBoost(chunk, context, hasExactGradeMatch) +
        computeIntentBoost(question, kind, contextMode);

      return {
        ...chunk,
        rankingScore,
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore);
}

function buildChunkQueryFilters(input: ChunkQueryInput): ChunkQueryFilters {
  const mode = input.mode ?? "mixed";
  const normalizedSubject = normalizeSubject(input.subject);
  const normalizedGrade = parseGradeLevel(input.grade);
  const allowedSubjects = normalizeSubjectList(input.allowedSubjects ?? []);
  const allowedGrades = normalizeGradeList(input.allowedGrades ?? []);
  const sourceTypes =
    input.sourceTypes && input.sourceTypes.length > 0
      ? input.sourceTypes
      : mode === "classroom"
        ? ["curriculum_content"]
        : mode === "policy"
          ? ["policy_document"]
          : ["curriculum_content", "policy_document"];

  return {
    sourceTypes,
    allowedSubjects,
    allowedGrades,
    normalizedSubject,
    normalizedGrade,
  };
}

async function queryRelevantChunkRows(
  input: ChunkQueryInput,
  filters: ChunkQueryFilters,
  rawLimit: number,
  vectorSql: Prisma.Sql,
  tier: ClassroomFallbackTier = "default"
): Promise<ChunkRetrievalRow[]> {
  const mode = input.mode ?? "mixed";
  const effectiveAllowedSubjects =
    filters.normalizedSubject
      ? normalizeSubjectList([filters.normalizedSubject, ...filters.allowedSubjects])
      : filters.allowedSubjects;
  const effectiveAllowedGrades =
    tier === "nearby_grade" && filters.normalizedGrade != null
      ? expandNearbyGrades(filters.normalizedGrade).filter((grade) => grade !== filters.normalizedGrade)
      : filters.allowedGrades;
  const sourceTypeFilter = Prisma.sql`AND "sourceType" IN (${Prisma.join(filters.sourceTypes)})`;
  const allowedSubjectFilter = effectiveAllowedSubjects.length
    ? Prisma.sql`AND ("subject" IN (${Prisma.join(effectiveAllowedSubjects)}) OR "subject" IS NULL)`
    : Prisma.empty;
  const allowedGradeFilter = effectiveAllowedGrades.length
    ? Prisma.sql`AND ("grade" IN (${Prisma.join(effectiveAllowedGrades)}) OR "grade" IS NULL)`
    : Prisma.empty;
  const subjectFilter = filters.normalizedSubject
    ? mode === "classroom"
      ? tier === "null_grade"
        ? Prisma.sql`AND ("subject" = ${filters.normalizedSubject} OR "subject" IS NULL)`
        : Prisma.sql`AND "subject" = ${filters.normalizedSubject}`
      : Prisma.sql`AND ("subject" = ${filters.normalizedSubject} OR "subject" IS NULL)`
    : Prisma.empty;
  const gradeFilter =
    filters.normalizedGrade != null
      ? mode === "classroom"
        ? tier === "same_grade"
          ? Prisma.sql`AND "grade" = ${filters.normalizedGrade}`
          : tier === "nearby_grade"
            ? effectiveAllowedGrades.length > 0
              ? Prisma.sql`AND "grade" IN (${Prisma.join(effectiveAllowedGrades)})`
              : Prisma.sql`AND FALSE`
            : tier === "null_grade"
              ? Prisma.sql`AND "grade" IS NULL`
              : Prisma.sql`AND "grade" = ${filters.normalizedGrade}`
        : Prisma.sql`AND ("grade" = ${filters.normalizedGrade} OR "grade" IS NULL)`
      : Prisma.empty;

  return prisma.$queryRaw<ChunkRetrievalRow[]>(
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
      user: {
        select: {
          schoolId: true,
        },
      },
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

  const questionEmbedding = await embedTextForCacheScope(trimmedQuestion, {
    tenantId: student.user?.schoolId ?? "global",
    role: "student",
  });
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

  const questionEmbedding = await embedTextForCacheScope(trimmedQuestion, {
    tenantId: input.schoolId,
    role: (input.context?.role ?? "system").toLowerCase(),
  });
  const vectorSql = buildVectorSql(questionEmbedding);
  const effectiveLimit = Math.max(1, Math.min(input.topK ?? input.limit ?? 5, 8));
  const rawLimit = Math.max(effectiveLimit * 3, 12);
  const mode = input.mode ?? "mixed";
  const filters = buildChunkQueryFilters(input);
  let rows: ChunkRetrievalRow[] = [];
  let retrievalTier: ClassroomFallbackTier = "default";

  if (mode === "classroom" && filters.normalizedGrade != null) {
    rows = await queryRelevantChunkRows(input, filters, rawLimit, vectorSql, "same_grade");
    retrievalTier = "same_grade";

    if (rows.length === 0) {
      const nearbyRows = await queryRelevantChunkRows(input, filters, rawLimit, vectorSql, "nearby_grade");
      if (nearbyRows.length > 0) {
        rows = nearbyRows;
        retrievalTier = "nearby_grade";
      }
    }

    if (rows.length === 0) {
      const nullGradeRows = await queryRelevantChunkRows(input, filters, rawLimit, vectorSql, "null_grade");
      if (nullGradeRows.length > 0) {
        rows = nullGradeRows;
        retrievalTier = "null_grade";
      }
    }
  }

  if (rows.length === 0) {
    rows = await queryRelevantChunkRows(input, filters, rawLimit, vectorSql, "default");
    retrievalTier = "default";
  }

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
    retrievalTier,
    metadata: row.metadata,
  })),
    trimmedQuestion,
    input.context
  );

  return rankedChunks.slice(0, effectiveLimit);
}
