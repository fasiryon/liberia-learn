// app/api/admin/content-review/[lessonId]/unpublish/route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { sendPushToUser } from "@/lib/push/sendPush";

const BodySchema = z.object({ reason: z.string().max(500).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    const { reason } = BodySchema.parse(await req.json().catch(() => ({})));

    const lesson = await prisma.curriculumContent.findUnique({
      where: { id: params.lessonId },
      select: { id: true, contentId: true, title: true, editedById: true, editReviewStatus: true },
    });
    if (!lesson) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (lesson.editReviewStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "invalid_transition", from: lesson.editReviewStatus, to: "PENDING" },
        { status: 409 }
      );
    }

    await prisma.curriculumContent.update({
      where: { id: lesson.id },
      data: { editReviewStatus: "PENDING", status: "draft", publishedAt: null },
    });

    await logAudit({
      userId: user.id,
      action: "teacher.lesson.emergency_unpublish",
      resourceType: "curriculum",
      resourceId: lesson.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: { reason: reason ?? null, adminId: user.id },
    });

    if (lesson.editedById) {
      const title = lesson.title ?? "Untitled";
      const body = reason
        ? `Your lesson "${title}" was unpublished by an admin. Reason: ${reason}. Please revise and resubmit.`
        : `Your lesson "${title}" was temporarily unpublished by an admin. Please revise and resubmit.`;
      await prisma.notificationInboxItem.create({
        data: { userId: lesson.editedById, title: "Lesson unpublished", body, url: "/teacher/lessons" },
      });
      void sendPushToUser(lesson.editedById, { title: "Lesson unpublished", body }).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/admin/content-review/${params.lessonId}/unpublish`,
      method: "POST",
      requestId: traceId,
    });
  }
}
