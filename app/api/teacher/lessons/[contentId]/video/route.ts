import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadLessonVideoToVercelBlob, validateLessonVideoFile } from "@/lib/lessons/videoUpload";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export const dynamic = "force-dynamic";

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

    const storageUrl = await uploadLessonVideoToVercelBlob({
      lessonId: content.contentId,
      teacherId: user.id,
      file,
    });

    const video = await prisma.lessonVideo.create({
      data: {
        lessonId: content.contentId,
        uploadedBy: user.id,
        title,
        description,
        storageUrl,
        durationSeconds,
        fileSize: file.size,
        isActive: false,
      },
    });
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
    return NextResponse.json({ video });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Video upload failed" }, { status: error?.status ?? 500 });
  }
}
