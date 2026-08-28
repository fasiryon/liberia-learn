import { prisma } from "@/lib/db";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

type SessionUserLike = {
  id: string;
  schoolId?: string | null;
};

export type ScheduledLessonContext = {
  scheduledWorkId: string;
  contentId: string;
  studentId: string;
  schoolId: string;
  classId: string;
  title: string;
  subject: string;
  grade: number;
  body: string;
  lessonQuizQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
};

export async function resolveScheduledLessonContext(
  user: SessionUserLike,
  scheduledWorkId: string
): Promise<ScheduledLessonContext> {
  const [scheduledWork, student] = await Promise.all([
    prisma.scheduledWork.findUnique({
      where: { id: scheduledWorkId },
      include: {
        content: {
          select: {
            contentId: true,
            payload: true,
            subject: true,
            grade: true,
          },
        },
        class: {
          select: {
            id: true,
            schoolId: true,
          },
        },
      },
    }),
    prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }),
  ]);

  if (!scheduledWork) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  if (!student) {
    throw Object.assign(new Error("student_not_found"), { status: 404 });
  }

  if (scheduledWork.class.schoolId !== user.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_classId: {
        studentId: student.id,
        classId: scheduledWork.class.id,
      },
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const payload = (scheduledWork.content.payload ?? {}) as Record<string, unknown>;
  const body =
    (typeof payload.body_standard === "string" && payload.body_standard.trim()) ||
    (typeof payload.body === "string" && payload.body.trim()) ||
    (typeof payload.body_block === "string" && payload.body_block.trim()) ||
    "";

  return {
    scheduledWorkId: scheduledWork.id,
    contentId: scheduledWork.content.contentId,
    studentId: student.id,
    schoolId: scheduledWork.class.schoolId,
    classId: scheduledWork.class.id,
    title: resolveLessonTitle({
      payload,
      subject: String(scheduledWork.content.subject),
      fallbackTitle: scheduledWork.content.contentId,
    }),
    subject: String(scheduledWork.content.subject),
    grade: Number(scheduledWork.content.grade ?? 0),
    body,
    lessonQuizQuestions: extractLessonQuizQuestions(payload),
  };
}

function extractLessonQuizQuestions(payload: Record<string, unknown>) {
  const assessmentPlan = payload.assessmentPlan;
  if (!assessmentPlan || typeof assessmentPlan !== "object" || Array.isArray(assessmentPlan)) return undefined;
  const lessonQuiz = (assessmentPlan as Record<string, unknown>).lessonQuiz;
  if (!lessonQuiz || typeof lessonQuiz !== "object" || Array.isArray(lessonQuiz)) return undefined;
  const items = (lessonQuiz as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length !== 5) return undefined;

  const questions = items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const value = item as Record<string, unknown>;
    if (
      typeof value.id !== "string" ||
      typeof value.prompt !== "string" ||
      !Array.isArray(value.options) ||
      value.options.length !== 4 ||
      value.options.some((option) => typeof option !== "string") ||
      !Number.isInteger(value.correctIndex) ||
      Number(value.correctIndex) < 0 ||
      Number(value.correctIndex) > 3 ||
      typeof value.explanation !== "string"
    ) return null;
    return {
      id: value.id,
      question: value.prompt,
      options: value.options as string[],
      correctIndex: value.correctIndex as number,
      explanation: value.explanation,
    };
  });

  return questions.every(Boolean) ? questions as NonNullable<ScheduledLessonContext["lessonQuizQuestions"]> : undefined;
}
