import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { updateCurriculumContent } from "@/lib/curriculum/mutations/repository";

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  bodyHtml: z.string().max(200000).optional(),
  // Teachers may resubmit their content, but cannot approve or reject it.
  editReviewStatus: z.literal("PENDING").optional(),
  learningObjectives: z.array(z.string().max(300)).max(8).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");
    const body = PatchSchema.parse(await req.json());

    const lesson = await prisma.curriculumContent.findUnique({
      where: { id: params.contentId },
      select: {
        id: true,
        contentId: true,
        title: true,
        payload: true,
        editedById: true,
        scheduledWork: { select: { classId: true }, take: 1 },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Teacher must own the lesson (editedById) OR teach a class that uses it
    const ownsLesson = lesson.editedById === user.id;
    if (!ownsLesson) {
      const classIds = lesson.scheduledWork.map((s) => s.classId);
      if (classIds.length > 0) {
        const taught = await prisma.class.findFirst({
          where: { id: { in: classIds }, teacherId: user.id },
          select: { id: true },
        });
        if (!taught) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Snapshot current body before overwriting
    if (body.bodyHtml !== undefined) {
      const currentBody =
        (lesson.payload as Record<string, unknown>)?.body ?? "";
      await prisma.lessonVersion.create({
        data: {
          lessonId: lesson.id,
          authorId: user.id,
          bodyHtml:
            typeof currentBody === "string" ? currentBody : JSON.stringify(currentBody),
          metadata: { snapshotReason: "pre-edit" },
        },
      });

      // Prune versions beyond 20
      const oldest = await prisma.lessonVersion.findMany({
        where: { lessonId: lesson.id },
        orderBy: { createdAt: "asc" },
        skip: 20,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await prisma.lessonVersion.deleteMany({
          where: { id: { in: oldest.map((v) => v.id) } },
        });
      }
    }

    const updatePayload = {
      ...(lesson.payload as Record<string, unknown>),
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.bodyHtml !== undefined ? { body: body.bodyHtml } : {}),
    };

    const governed = await updateCurriculumContent(
      { id: lesson.id },
      {
        ...(body.title !== undefined ? { title: body.title } : {}),
        payload: updatePayload,
        editedById: user.id,
        editedAt: new Date(),
        ...(body.editReviewStatus !== undefined
          ? { editReviewStatus: body.editReviewStatus }
          : {}),
        ...(body.learningObjectives !== undefined
          ? { learningObjectives: body.learningObjectives }
          : {}),
      },
      {
        revisionKind: "HUMAN_EDIT",
        originKind: "HUMAN_AUTHORED",
        actorUserId: user.id,
        authorUserId: user.id,
        requestedCompleteness: "VERIFIED",
        auditAction: "curriculum.revision.teacher_edit",
        schoolId: user.schoolId ?? null,
        traceId,
        idempotencyKey: `teacher-body-edit:${traceId}`,
      },
    );
    const updated = governed.content;

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.edited",
      resourceType: "curriculum",
      resourceId: updated.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: { editReviewStatus: body.editReviewStatus },
    });

    return NextResponse.json({
      id: updated.id,
      contentId: updated.contentId,
      editReviewStatus: updated.editReviewStatus,
    });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/teacher/lessons/${params.contentId}`,
      method: "PATCH",
      requestId: traceId,
    });
  }
}
