import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadLessonVideoToVercelBlob, validateLessonVideoFile } from "@/lib/lessons/videoUpload";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { logAudit } from "@/lib/audit";
import { sendPushToMany } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024; // 2MB

async function checkAndUpdateQuota(schoolId: string, fileSize: number): Promise<void> {
  const quota = await prisma.schoolStorageQuota.upsert({
    where: { schoolId },
    create: { schoolId, usedBytes: 0, limitBytes: 5368709120 },
    update: {},
  });
  if (quota.usedBytes + fileSize > quota.limitBytes) {
    throw Object.assign(
      new Error("Storage quota exceeded. Contact your school admin."),
      { status: 413 }
    );
  }
}

async function incrementQuota(schoolId: string, fileSize: number): Promise<void> {
  await prisma.schoolStorageQuota.upsert({
    where: { schoolId },
    create: { schoolId, usedBytes: fileSize, limitBytes: 5368709120 },
    update: { usedBytes: { increment: fileSize } },
  });
}

export async function POST(
  req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, subject: true, grade: true },
    });
    if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 });
    }
    const title = String(form.get("title") ?? "").trim() || "Teacher introduction";
    const description = String(form.get("description") ?? "").trim() || null;
    const durationSeconds = Number(form.get("durationSeconds") ?? 0);

    validateLessonVideoFile({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      durationSeconds,
    });

    // Check school storage quota before uploading
    if (user.schoolId) {
      await checkAndUpdateQuota(user.schoolId, file.size);
    }

    const storageUrl = await uploadLessonVideoToVercelBlob({
      lessonId: content.contentId,
      teacherId: user.id,
      file,
    });

    // Handle optional thumbnail upload
    let thumbnailUrl: string | null = null;
    const thumbnailFile = form.get("thumbnail");
    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      if (thumbnailFile.size > MAX_THUMBNAIL_BYTES) {
        return NextResponse.json({ error: "Thumbnail must be 2MB or smaller." }, { status: 413 });
      }
      const { put } = await import("@vercel/blob");
      const ext = thumbnailFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const blob = await put(
        `thumbnails/${content.contentId}/${Date.now()}-thumb.${ext}`,
        Buffer.from(await thumbnailFile.arrayBuffer()),
        { access: "public", contentType: thumbnailFile.type || "image/jpeg" }
      );
      thumbnailUrl = blob.url;
    }

    const video = await prisma.lessonVideo.create({
      data: {
        lessonId: content.contentId,
        uploadedBy: user.id,
        title,
        description,
        storageUrl,
        thumbnailUrl,
        durationSeconds,
        fileSize: file.size,
        storageBytes: file.size,
        isActive: false,
        status: "PENDING",
        schoolId: user.schoolId ?? null,
      },
    });

    // Update storage quota
    if (user.schoolId) {
      await incrementQuota(user.schoolId, file.size);
    }

    await logLearningEvent({
      schoolId: user.schoolId ?? null,
      userId: user.id,
      actor: { type: "user", id: user.id, role: user.role },
      eventType: "LESSON_VIDEO_UPLOADED",
      source: "/api/teacher/lessons/video",
      contentId: content.contentId,
      lessonId: content.contentId,
      subject: content.subject,
      grade: content.grade,
      metadata: { videoId: video.id, fileSize: file.size, durationSeconds },
    });

    void logAudit({
      userId: user.id,
      action: "video.uploaded",
      resourceType: "LessonVideo",
      resourceId: video.id,
      details: { contentId: content.contentId, fileSize: file.size, status: "PENDING" },
    }).catch(() => {});

    // Notify admins in the school
    if (user.schoolId) {
      const admins = await prisma.user.findMany({
        where: { schoolId: user.schoolId, role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length > 0) {
        void sendPushToMany(
          admins.map((a) => a.id),
          {
            title: "New video pending review",
            body: `${user.name ?? "A teacher"} uploaded a video for lesson ${title}`,
            url: "/admin/video-moderation",
          }
        ).catch(() => {});
      }
    }

    return NextResponse.json({ video });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Video upload failed" }, { status: error?.status ?? 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const videos = await prisma.lessonVideo.findMany({
      where: {
        lessonId: params.contentId,
        uploadedBy: user.role === "ADMIN" ? undefined : user.id,
      },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        storageUrl: true,
        thumbnailUrl: true,
        durationSeconds: true,
        fileSize: true,
        isActive: true,
        status: true,
        rejectedReason: true,
        viewCount: true,
        uploadedAt: true,
        schoolId: true,
      },
    });

    // Storage quota info
    let storageInfo: { usedBytes: number; limitBytes: number } | null = null;
    if (user.schoolId) {
      const quota = await prisma.schoolStorageQuota.findUnique({
        where: { schoolId: user.schoolId },
        select: { usedBytes: true, limitBytes: true },
      });
      storageInfo = quota;
    }

    return NextResponse.json({ videos, storageInfo });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
