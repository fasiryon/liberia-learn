import { prisma } from "@/lib/db";
import { completeScheduledLesson } from "@/lib/student/completeScheduledLesson";

type SessionUserLike = {
  id: string;
  schoolId?: string | null;
};

// Sentinel date keeps virtual rows out of the Today page (same-day window)
// and catch-up (trailing 14 days) queries, which both filter by scheduledDate.
const VIRTUAL_SCHEDULED_DATE = new Date("2001-01-01T00:00:00.000Z");

/**
 * Completes a teacher-created lesson for a student.
 *
 * StudentProgress.scheduledWorkId is required, so teacher lessons (which are
 * assigned via TeacherLessonAssignment, not the timetable) get a virtual
 * ScheduledWork row created on first completion. The row is backdated to a
 * sentinel date so it never appears in Today/catch-up schedule queries, and
 * marked status "teacher_lesson_virtual" for identification.
 *
 * Delegates to completeScheduledLesson so the full pipeline runs unchanged:
 * StudentProgress upsert → mastery → audit → product signal → guardian
 * notification → certificate check → streak. Guardian digest and league
 * scoring both count StudentProgress rows, so they pick this up too.
 */
export async function completeTeacherLesson(user: SessionUserLike, contentId: string) {
  const content = await prisma.curriculumContent.findUnique({
    where: { contentId },
    select: {
      contentId: true,
      teacherCreated: true,
      editReviewStatus: true,
      visibility: true,
      schoolId: true,
      editedById: true,
    },
  });
  if (!content || !content.teacherCreated) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  if (content.editReviewStatus !== "APPROVED") {
    throw Object.assign(new Error("Lesson not available"), { status: 403 });
  }

  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, enrollments: { select: { classId: true } } },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }
  const classIds = student.enrollments.map((e) => e.classId);
  if (classIds.length === 0) {
    throw Object.assign(new Error("No class enrollment"), { status: 403 });
  }

  // Visibility: assigned to one of the student's classes, or school_wide
  // at the student's school. Mirrors GET /api/student/teacher-lessons.
  const assignment = await prisma.teacherLessonAssignment.findFirst({
    where: { contentId, classId: { in: classIds } },
    select: { classId: true },
  });
  const schoolWideVisible =
    content.visibility === "school_wide" &&
    content.schoolId != null &&
    content.schoolId === user.schoolId;
  if (!assignment && !schoolWideVisible) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const classId = assignment?.classId ?? classIds[0];

  // Reuse a real ScheduledWork row if the lesson is also on the timetable;
  // otherwise create a virtual one.
  let sw = await prisma.scheduledWork.findFirst({
    where: { contentId, classId: { in: classIds } },
    select: { id: true },
  });
  if (!sw) {
    sw = await prisma.scheduledWork.create({
      data: {
        contentId,
        classId,
        scheduledDate: VIRTUAL_SCHEDULED_DATE,
        createdById: content.editedById ?? user.id,
        status: "teacher_lesson_virtual",
        isDelivered: true,
        deliveredAt: new Date(),
      },
      select: { id: true },
    });
  }

  return completeScheduledLesson({ user, scheduledWorkId: sw.id });
}
