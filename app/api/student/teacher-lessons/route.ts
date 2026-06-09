import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { enrollments: { select: { classId: true } } },
    });
    const classIds = student?.enrollments.map((e) => e.classId) ?? [];
    const schoolId = user.schoolId ?? null;
    const now = new Date();

    // Path 1: class_only assigned lessons
    const assignments = classIds.length > 0
      ? await prisma.teacherLessonAssignment.findMany({
          where: {
            classId: { in: classIds },
            OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
            content: { editReviewStatus: "APPROVED" },
          },
          include: {
            content: {
              select: {
                id: true, contentId: true, title: true, grade: true, subject: true,
                editedBy: { select: { name: true } },
                editReviewStatus: true, visibility: true,
              },
            },
          },
        })
      : [];

    // Path 2: school_wide lessons (no assignment needed)
    const schoolWide = schoolId
      ? await prisma.curriculumContent.findMany({
          where: {
            visibility: "school_wide",
            schoolId,
            editReviewStatus: "APPROVED",
          },
          select: {
            id: true, contentId: true, title: true, grade: true, subject: true,
            editedBy: { select: { name: true } },
            editReviewStatus: true, visibility: true,
          },
        })
      : [];

    const assignedContentIds = new Set(assignments.map((a) => a.content.contentId));

    const lessons = [
      ...assignments.map((a) => ({
        id: a.content.id,
        contentId: a.content.contentId,
        title: a.content.title,
        grade: a.content.grade,
        subject: a.content.subject,
        teacherAuthorName: a.content.editedBy?.name ?? null,
        lessonHref: `/student/lesson/${a.content.contentId}`,
        source: "teacher_assigned" as const,
      })),
      ...schoolWide
        .filter((c) => !assignedContentIds.has(c.contentId))
        .map((c) => ({
          id: c.id,
          contentId: c.contentId,
          title: c.title,
          grade: c.grade,
          subject: c.subject,
          teacherAuthorName: c.editedBy?.name ?? null,
          lessonHref: `/student/lesson/${c.contentId}`,
          source: "school_wide" as const,
        })),
    ];

    return NextResponse.json({ lessons });
  } catch (error) {
    return handleApiError(error, { route: "/api/student/teacher-lessons", method: "GET", requestId: "tl" });
  }
}
