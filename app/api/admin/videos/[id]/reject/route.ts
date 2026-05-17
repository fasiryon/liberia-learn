import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireRole("ADMIN");

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

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

    if (video.schoolId && video.schoolId !== admin.schoolId && !admin.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.lessonVideo.update({
      where: { id: params.id },
      data: {
        status: "REJECTED",
        isActive: false,
        rejectedReason: reason,
        approvedBy: null,
        approvedAt: null,
      },
    });

    void logAudit({
      userId: admin.id,
      action: "video.rejected",
      resourceType: "LessonVideo",
      resourceId: params.id,
      details: { title: video.title, reason },
    }).catch(() => {});

    void sendPushToUser(video.uploadedBy, {
      title: "Video rejected",
      body: `Your video "${video.title}" was rejected: ${reason}`,
      url: `/teacher/lesson/${video.lesson.contentId}`,
    }).catch(() => {});

    return NextResponse.json({ video: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
