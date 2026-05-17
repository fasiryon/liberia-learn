import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireRole("ADMIN");

    const video = await prisma.lessonVideo.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        uploadedBy: true,
        schoolId: true,
        status: true,
        lesson: { select: { contentId: true } },
      },
    });

    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Admin can only approve videos for their school
    if (video.schoolId && video.schoolId !== admin.schoolId && !admin.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.lessonVideo.update({
      where: { id: params.id },
      data: {
        status: "APPROVED",
        isActive: true,
        approvedBy: admin.id,
        approvedAt: new Date(),
        rejectedReason: null,
      },
    });

    void logAudit({
      userId: admin.id,
      action: "video.approved",
      resourceType: "LessonVideo",
      resourceId: params.id,
      details: { title: video.title },
    }).catch(() => {});

    void sendPushToUser(video.uploadedBy, {
      title: "Video approved",
      body: `Your video "${video.title}" was approved and is now visible to students`,
      url: `/teacher/lesson/${video.lesson.contentId}`,
    }).catch(() => {});

    return NextResponse.json({ video: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
