// app/api/admin/content-review/[lessonId]/route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { sendPushToUser } from "@/lib/push/sendPush";

// State machine: maps current status → allowed target statuses
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  REJECTED: ["PENDING"], // teacher resubmit via teacher route
};

const PatchSchema = z.discriminatedUnion("editReviewStatus", [
  z.object({ editReviewStatus: z.literal("APPROVED") }),
  z.object({
    editReviewStatus: z.literal("REJECTED"),
    rejectionReason: z.string().min(1).max(500),
  }),
  z.object({ editReviewStatus: z.literal("PENDING") }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    const body = PatchSchema.parse(await req.json());

    const lesson = await prisma.curriculumContent.findUnique({
      where: { id: params.lessonId },
      select: {
        id: true,
        contentId: true,
        title: true,
        editedById: true,
        editReviewStatus: true,
      },
    });
    if (!lesson) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const currentStatus = lesson.editReviewStatus ?? "null";
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(body.editReviewStatus)) {
      return NextResponse.json(
        { error: "invalid_transition", from: currentStatus, to: body.editReviewStatus },
        { status: 409 }
      );
    }

    const isApprove = body.editReviewStatus === "APPROVED";
    const isReject = body.editReviewStatus === "REJECTED";

    const rejectionReason = isReject && body.editReviewStatus === "REJECTED" ? body.rejectionReason : undefined;

    const updated = await prisma.curriculumContent.update({
      where: { id: lesson.id },
      data: {
        editReviewStatus: body.editReviewStatus,
        status: isApprove ? "published" : "draft",
        ...(isApprove ? { publishedAt: new Date() } : {}),
        ...(isReject ? { rejectionReason } : {}),
      },
    });

    await logAudit({
      userId: user.id,
      action: isApprove
        ? "teacher.lesson.published"
        : isReject
        ? "teacher.lesson.rejected"
        : "teacher.lesson.resubmit_allowed",
      resourceType: "curriculum",
      resourceId: lesson.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: isReject ? { rejectionReason } : {},
    });

    if (lesson.editedById) {
      const title = lesson.title ?? "Your lesson";
      const notifBody = isApprove
        ? `"${title}" was approved and is now published.`
        : `"${title}" was not approved. Reason: ${rejectionReason}`;
      await prisma.notificationInboxItem.create({
        data: {
          userId: lesson.editedById,
          title: "Lesson review update",
          body: notifBody,
          url: "/teacher/lessons",
        },
      });
      void sendPushToUser(lesson.editedById, {
        title: "Lesson review update",
        body: notifBody,
      }).catch(() => null);
    }

    return NextResponse.json({
      id: updated.id,
      editReviewStatus: updated.editReviewStatus,
      status: updated.status,
    });
  } catch (error) {
    return handleApiError(error, {
      route: `/api/admin/content-review/${params.lessonId}`,
      method: "PATCH",
      requestId: traceId,
    });
  }
}
