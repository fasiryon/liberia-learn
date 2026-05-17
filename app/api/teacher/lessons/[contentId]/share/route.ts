import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

const ShareSchema = z.object({ schoolId: z.string().min(1) });

async function assertLessonOwner(userId: string, lessonId: string) {
  const lesson = await prisma.curriculumContent.findUnique({
    where: { id: lessonId },
    select: { id: true, editedById: true },
  });
  if (!lesson) return null;
  if (lesson.editedById !== userId) return null;
  return lesson;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");
    const body = ShareSchema.parse(await req.json());

    const lesson = await assertLessonOwner(user.id, params.contentId);
    if (!lesson) {
      return NextResponse.json({ error: "Forbidden or lesson not found" }, { status: 403 });
    }

    const share = await prisma.lessonShare.upsert({
      where: { lessonId_schoolId: { lessonId: lesson.id, schoolId: body.schoolId } },
      create: { lessonId: lesson.id, sharedById: user.id, schoolId: body.schoolId },
      update: {},
    });

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.shared",
      resourceType: "curriculum",
      resourceId: params.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: { schoolId: body.schoolId, shareId: share.id },
    });

    return NextResponse.json({ shareId: share.id });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/share`,
      method: "POST",
      requestId: traceId,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");
    const { schoolId } = ShareSchema.parse(await req.json());

    const lesson = await assertLessonOwner(user.id, params.contentId);
    if (!lesson) {
      return NextResponse.json({ error: "Forbidden or lesson not found" }, { status: 403 });
    }

    await prisma.lessonShare.deleteMany({
      where: { lessonId: lesson.id, schoolId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}/share`,
      method: "DELETE",
      requestId: traceId,
    });
  }
}
