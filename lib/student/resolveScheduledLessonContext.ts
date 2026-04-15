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
  };
}
