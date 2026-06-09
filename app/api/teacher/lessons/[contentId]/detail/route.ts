import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(
  _req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");

    const lesson = await prisma.curriculumContent.findUnique({
      where: { id: params.contentId },
      select: {
        id: true,
        contentId: true,
        title: true,
        payload: true,
        editedById: true,
        editReviewStatus: true,
        lessonVersion: true,
        learningObjectives: true,
        scheduledWork: { select: { classId: true }, take: 1 },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const ownsLesson = lesson.editedById === user.id;
    if (!ownsLesson) {
      const classIds = lesson.scheduledWork.map((s) => s.classId);
      if (classIds.length > 0) {
        const taught = await prisma.class.findFirst({
          where: { id: { in: classIds }, teacherId: user.id },
          select: { id: true },
        });
        if (!taught) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const payload = lesson.payload as Record<string, unknown>;
    const bodyHtml =
      typeof payload?.body === "string" ? payload.body : "";

    return NextResponse.json({
      id: lesson.id,
      contentId: lesson.contentId,
      title: lesson.title,
      bodyHtml,
      editReviewStatus: lesson.editReviewStatus,
      lessonVersion: lesson.lessonVersion,
      learningObjectives: Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives : [],
    });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/detail`,
      method: "GET",
      requestId: traceId,
    });
  }
}
