import { Prisma } from "@prisma/client";
import { embedText } from "@/lib/ai/rag/embeddingService";
import { prisma } from "@/lib/db";

export type RelevantLesson = {
  id: string;
  title: string;
  content: string;
  subject: string;
  gradeLevel: number;
  similarity: number;
};

type RetrievalRow = {
  id: string;
  title: string | null;
  content: string | null;
  subject: string;
  gradeLevel: number;
  similarity: number;
};

function toVectorLiteral(vector: number[]): string {
  if (vector.length === 0) {
    throw new Error("Question embedding is empty");
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error("Question embedding contains non-finite values");
    }
  }

  return `[${vector.join(",")}]`;
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
  const vectorSql = Prisma.raw(`'${toVectorLiteral(questionEmbedding)}'::vector`);
  const subjectFilter = enrolledSubjects.length
    ? Prisma.sql`AND "subject" IN (${Prisma.join(enrolledSubjects)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<RetrievalRow[]>(
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
