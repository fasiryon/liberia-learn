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
      select: { id: true, editedById: true, scheduledWork: { select: { classId: true }, take: 1 } },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const ownsLesson = lesson.editedById === user.id;
    if (!ownsLesson) {
      const classIds = lesson.scheduledWork.map((s) => s.classId);
      const taught = classIds.length > 0
        ? await prisma.class.findFirst({ where: { id: { in: classIds }, teacherId: user.id }, select: { id: true } })
        : null;
      if (!taught) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const versions = await prisma.lessonVersion.findMany({
      where: { lessonId: lesson.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        bodyHtml: true,
        metadata: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/versions`,
      method: "GET",
      requestId: traceId,
    });
  }
}
