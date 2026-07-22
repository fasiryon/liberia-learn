import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const examQuestionInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().trim().min(1).max(2000),
  moeCode: z.string().trim().min(1).max(64),
  points: z.number().int().min(1).max(20).optional().default(1),
}).superRefine((value, ctx) => {
  if (value.correctIndex >= value.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctIndex"],
      message: "correctIndex must match one of the provided options",
    });
  }
});

export const createExamSchema = z.object({
  title: z.string().trim().min(3).max(200),
  subject: z.string().trim().min(1).max(64),
  grade: z.number().int().min(1).max(12),
  moeStandards: z.array(z.string().trim().min(1).max(64)).min(1).max(40),
  timeLimit: z.number().int().min(10).max(240),
  passingScore: z.number().min(0).max(1).optional().default(0.7),
  academicYearId: z.string().trim().min(1).nullable().optional(),
  classId: z.string().trim().min(1).nullable().optional(),
  questions: z.array(examQuestionInputSchema).min(5).max(100),
});

export const updateExamSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  subject: z.string().trim().min(1).max(64).optional(),
  grade: z.number().int().min(1).max(12).optional(),
  moeStandards: z.array(z.string().trim().min(1).max(64)).min(1).max(40).optional(),
  timeLimit: z.number().int().min(10).max(240).optional(),
  passingScore: z.number().min(0).max(1).optional(),
  academicYearId: z.string().trim().min(1).nullable().optional(),
  classId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
});

export const examGenerationContextSchema = z.object({
  academicYearId: z.string().trim().min(1).nullable().optional(),
  classId: z.string().trim().min(1).nullable().optional(),
});

type ExamQuestionInput = z.infer<typeof examQuestionInputSchema>;

type ExamScopeContext = {
  academicYearId?: string | null;
  classId?: string | null;
  subject?: string;
};

type AttemptLogEntry = {
  type: string;
  at: string;
  detail?: string | null;
};

export const submitExamSchema = z.object({
  attemptId: z.string().min(1),
  answers: z.array(z.number().int().min(0).max(5)),
  flags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  tabSwitchCount: z.number().int().min(0).max(500).optional(),
  submissionLog: z.array(
    z.object({
      type: z.string().trim().min(1).max(64),
      at: z.string().trim().min(1).max(64),
      detail: z.string().trim().max(200).optional(),
    })
  ).max(200).optional(),
});

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function getSubjectMismatchMessage(examSubject: string, classSubject: string) {
  return `Exam subject ${examSubject} must match class subject ${classSubject}`;
}

function getAcademicYearModel() {
  return (prisma as typeof prisma & {
    academicYear?: {
      findFirst?: (args?: unknown) => Promise<any>;
      findMany?: (args?: unknown) => Promise<any[]>;
    };
  }).academicYear;
}

function getClassModel() {
  return (prisma as typeof prisma & {
    class?: {
      findFirst?: (args?: unknown) => Promise<any>;
      findMany?: (args?: unknown) => Promise<any[]>;
    };
  }).class;
}

export async function assertExamScopeContext(schoolId: string, input: ExamScopeContext) {
  const academicYearOmitted = input.academicYearId === undefined;
  const normalized = {
    academicYearId: input.academicYearId ?? null,
    classId: input.classId ?? null,
  };
  const academicYearModel = getAcademicYearModel();
  const classModel = getClassModel();

  if (academicYearOmitted && academicYearModel?.findFirst) {
    const activeAcademicYear = await academicYearModel.findFirst({
      where: { schoolId, isActive: true },
      select: { id: true },
    });
    if (activeAcademicYear) {
      normalized.academicYearId = activeAcademicYear.id;
    } else {
      throw Object.assign(
        new Error("An academic year is required before creating an exam. Create and activate an academic year for this school first."),
        { status: 409 }
      );
    }
  }

  const [academicYear, classRecord] = await Promise.all([
    normalized.academicYearId && academicYearModel?.findFirst
      ? academicYearModel.findFirst({
          where: { id: normalized.academicYearId, schoolId },
          select: { id: true, yearLabel: true },
        })
      : Promise.resolve(null),
    normalized.classId && classModel?.findFirst
      ? classModel.findFirst({
          where: { id: normalized.classId, schoolId },
          select: { id: true, name: true, subject: true },
        })
      : Promise.resolve(null),
  ]);

  if (normalized.academicYearId && academicYearModel?.findFirst && !academicYear) {
    throw Object.assign(new Error("Academic year not found for this school"), { status: 400 });
  }
  if (normalized.classId && classModel?.findFirst && !classRecord) {
    throw Object.assign(new Error("Class not found for this school"), { status: 400 });
  }
  if (classRecord && input.subject && String(classRecord.subject) !== input.subject) {
    throw Object.assign(
      new Error(getSubjectMismatchMessage(input.subject, String(classRecord.subject))),
      { status: 400 }
    );
  }

  return {
    academicYearId: academicYear?.id ?? normalized.academicYearId,
    classId: classRecord?.id ?? normalized.classId,
    academicYearLabel: academicYear?.yearLabel ?? null,
    className: classRecord?.name ?? null,
  };
}

export async function listExamSupportData(schoolId: string) {
  const academicYearModel = getAcademicYearModel();
  const classModel = getClassModel();
  const [academicYears, classes] = await Promise.all([
    academicYearModel?.findMany
      ? academicYearModel.findMany({
          where: { schoolId },
          orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
          select: { id: true, yearLabel: true, isActive: true },
        })
      : Promise.resolve([]),
    classModel?.findMany
      ? classModel.findMany({
          where: { schoolId },
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true, subject: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    academicYears,
    classes: classes.map((item) => ({
      id: item.id,
      name: item.name,
      subject: String(item.subject),
    })),
  };
}

export async function listExamsForSchool(
  schoolId: string,
  filters?: { status?: string | null; subject?: string | null; grade?: number | null }
) {
  const exams = await prisma.exam.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(filters?.status ? { status: filters.status as any } : {}),
      ...(filters?.subject ? { subject: filters.subject } : {}),
      ...(filters?.grade ? { grade: filters.grade } : {}),
    },
    include: {
      class: { select: { id: true, name: true, subject: true } },
      academicYear: { select: { id: true, yearLabel: true, isActive: true } },
      attempts: {
        select: {
          id: true,
          score: true,
          passed: true,
          submittedAt: true,
          integrityFlags: true,
          tabSwitchCount: true,
        },
      },
      _count: { select: { questions: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return exams.map((exam) => {
    const submittedAttempts = exam.attempts.filter((attempt) => Boolean(attempt.submittedAt));
    const flaggedAttempts = submittedAttempts.filter(
      (attempt) => attempt.integrityFlags.length > 0 || attempt.tabSwitchCount > 0
    );
    const passCount = submittedAttempts.filter((attempt) => attempt.passed).length;
    const avgScore =
      submittedAttempts.length > 0
        ? submittedAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / submittedAttempts.length
        : 0;

    return {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      grade: exam.grade,
      status: exam.status,
      schoolId: exam.schoolId,
      academicYearId: exam.academicYearId,
      academicYearLabel: exam.academicYear?.yearLabel ?? null,
      classId: exam.classId,
      className: exam.class?.name ?? null,
      publishedAt: exam.publishedAt,
      resultsPublishedAt: exam.resultsPublishedAt,
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt,
      timeLimit: exam.timeLimit,
      passingScore: exam.passingScore,
      moeStandards: exam.moeStandards,
      questionCount: exam._count.questions,
      attemptCount: submittedAttempts.length,
      passRate: submittedAttempts.length > 0 ? passCount / submittedAttempts.length : 0,
      avgScore,
      flaggedCount: flaggedAttempts.length,
    };
  });
}

export async function getExamDetailForSchool(schoolId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId, deletedAt: null },
    include: {
      class: { select: { id: true, name: true, subject: true } },
      academicYear: { select: { id: true, yearLabel: true, isActive: true } },
      questions: true,
      attempts: {
        include: {
          student: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      },
    },
  });

  if (!exam) {
    throw Object.assign(new Error("Exam not found"), { status: 404 });
  }

  const submittedAttempts = exam.attempts.filter((attempt) => Boolean(attempt.submittedAt));
  const passCount = submittedAttempts.filter((attempt) => attempt.passed).length;
  const avgScore =
    submittedAttempts.length > 0
      ? submittedAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / submittedAttempts.length
      : 0;

  return {
    ...exam,
    questionCount: exam.questions.length,
    attemptCount: submittedAttempts.length,
    passRate: submittedAttempts.length > 0 ? passCount / submittedAttempts.length : 0,
    avgScore,
  };
}

function mergeSummary(existingSummary: unknown, patch: Record<string, unknown>) {
  const base =
    existingSummary && typeof existingSummary === "object" && !Array.isArray(existingSummary)
      ? { ...(existingSummary as Record<string, unknown>) }
      : {};

  return {
    ...base,
    ...patch,
  };
}

export async function syncTranscriptSummariesForExam(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      schoolId: true,
      academicYearId: true,
      resultsPublishedAt: true,
    },
  });

  if (!exam?.academicYearId || !exam.resultsPublishedAt) {
    return { updatedTranscripts: 0 };
  }

  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      submittedAt: { not: null },
    },
    select: { studentId: true },
    distinct: ["studentId"],
  });

  for (const attempt of attempts) {
    const publishedResults = await prisma.examAttempt.findMany({
      where: {
        studentId: attempt.studentId,
        submittedAt: { not: null },
        exam: {
          schoolId: exam.schoolId,
          academicYearId: exam.academicYearId,
          resultsPublishedAt: { not: null },
        },
      },
      select: {
        score: true,
        passed: true,
        submittedAt: true,
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            grade: true,
            resultsPublishedAt: true,
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }],
    });

    const averageScore =
      publishedResults.length > 0
        ? publishedResults.reduce((sum, result) => sum + result.score, 0) / publishedResults.length
        : 0;

    const latestPublishedResultAt = publishedResults[0]?.exam.resultsPublishedAt ?? null;

    const transcript = await prisma.transcript.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: attempt.studentId,
          academicYearId: exam.academicYearId,
        },
      },
      select: { id: true, grade: true, summary: true },
    });

    const examAuthoritySummary = {
      publishedExamCount: publishedResults.length,
      passedExamCount: publishedResults.filter((result) => result.passed).length,
      averageScorePct: Math.round(averageScore * 10000) / 100,
      latestPublishedResultAt,
      results: publishedResults.slice(0, 10).map((result) => ({
        examId: result.exam.id,
        title: result.exam.title,
        subject: result.exam.subject,
        grade: result.exam.grade,
        scorePct: Math.round(result.score * 10000) / 100,
        passed: result.passed,
        submittedAt: result.submittedAt?.toISOString() ?? null,
        resultsPublishedAt: result.exam.resultsPublishedAt?.toISOString() ?? null,
      })),
    };

    await prisma.transcript.upsert({
      where: {
        studentId_academicYearId: {
          studentId: attempt.studentId,
          academicYearId: exam.academicYearId,
        },
      },
      update: {
        schoolId: exam.schoolId,
        summary: toJson(
          mergeSummary(transcript?.summary, {
            examAuthority: examAuthoritySummary,
          })
        ),
      },
      create: {
        studentId: attempt.studentId,
        schoolId: exam.schoolId,
        academicYearId: exam.academicYearId,
        grade: transcript?.grade ?? publishedResults[0]?.exam.grade ?? 0,
        summary: toJson({
          examAuthority: examAuthoritySummary,
        }),
      },
    });
  }

  return { updatedTranscripts: attempts.length };
}

export function buildAttemptIntegrityMetadata(params: {
  flags: string[];
  tabSwitchCount: number;
  durationSeconds: number;
  weakMoeCodes: string[];
  suspiciousDuration: boolean;
  submissionLog: AttemptLogEntry[];
}) {
  return {
    flags: params.flags,
    tabSwitchCount: params.tabSwitchCount,
    durationSeconds: params.durationSeconds,
    weakMoeCodes: params.weakMoeCodes,
    suspiciousDuration: params.suspiciousDuration,
    submissionEvents: params.submissionLog,
  };
}

export function normalizeAttemptLog(entries?: AttemptLogEntry[]) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    type: entry.type,
    at: entry.at,
    detail: entry.detail ?? null,
  }));
}

export function buildExamQuestionCreates(questions: ExamQuestionInput[]) {
  return questions.map((question) => ({
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    moeCode: question.moeCode,
    points: question.points,
  }));
}
