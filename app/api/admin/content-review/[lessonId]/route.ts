import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { sendPushToUser } from "@/lib/push/sendPush";

const PatchSchema = z.object({
  editReviewStatus: z.enum(["APPROVED", "REJECTED"]),
  rejectionNote: z.string().max(500).optional(),
});

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
      select: { id: true, contentId: true, editedById: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const newStatus = body.editReviewStatus === "APPROVED" ? "approved" : "draft";

    const updated = await prisma.curriculumContent.update({
      where: { id: lesson.id },
      data: {
        editReviewStatus: body.editReviewStatus,
        status: newStatus,
      },
    });

    await logAudit({
      userId: user.id,
      action: `admin.content.${body.editReviewStatus.toLowerCase()}`,
      resourceType: "curriculum",
      resourceId: lesson.contentId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: { rejectionNote: body.rejectionNote },
    });

    // Push notification to teacher on rejection
    if (body.editReviewStatus === "REJECTED" && lesson.editedById) {
      const prefs = await prisma.teacherAlertPreference.findUnique({
        where: { teacherId: lesson.editedById },
        select: { alertNewSubmission: true },
      });
      if (prefs?.alertNewSubmission !== false) {
        sendPushToUser(lesson.editedById, {
          title: "Lesson review update",
          body: body.rejectionNote
            ? `Your lesson was not approved: ${body.rejectionNote}`
            : "Your lesson was not approved. Please review and resubmit.",
        }).catch(() => null);
      }
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
