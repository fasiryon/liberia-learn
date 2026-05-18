import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { selectLessonBody } from "@/lib/lessons";
import { generateSpeech, lessonToNarrationText, estimateElevenLabsCostUsd } from "@/lib/elevenlabs";
import { uploadBinaryToSupabase } from "@/lib/supabaseStorage";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("TEACHER");

    const lesson = await prisma.curriculumContent.findFirst({
      where: {
        OR: [{ id: params.id }, { contentId: params.id }],
      },
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        version: true,
        payload: true,
        editedById: true,
        scheduledWork: {
          select: { class: { select: { schoolId: true, teacherId: true } } },
          take: 1,
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Auth: teacher must teach a class using this lesson, or be the editor
    const teacherClass = lesson.scheduledWork[0]?.class;
    const isEditor = lesson.editedById === user.id;
    const isClassTeacher = teacherClass?.teacherId === user.id;
    const isSameSchool = teacherClass?.schoolId === user.schoolId;

    if (!isEditor && (!isClassTeacher || !isSameSchool)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = lesson.payload as any;
    const bodyText = selectLessonBody(
      { body: payload?.body, body_standard: payload?.body_standard, body_block: payload?.body_block },
      "standard"
    );

    if (!bodyText || bodyText.length < 100) {
      return NextResponse.json({ error: "Lesson has no readable content" }, { status: 422 });
    }

    const narrationText = lessonToNarrationText({
      title: lesson.title ?? lesson.subject,
      body_standard: payload?.body_standard,
      body: payload?.body,
    });

    const voice = "elevenlabs-rachel";

    await prisma.lessonAudio.upsert({
      where: {
        lessonId_contentVersion_voice: {
          lessonId: lesson.contentId,
          contentVersion: lesson.version,
          voice,
        },
      },
      update: { status: "PROCESSING", estimatedCostUsd: estimateElevenLabsCostUsd(narrationText) },
      create: {
        lessonId: lesson.contentId,
        contentVersion: lesson.version,
        voice,
        status: "PROCESSING",
        estimatedCostUsd: estimateElevenLabsCostUsd(narrationText),
      },
    });

    const mp3 = await generateSpeech(narrationText);

    const safeSubject = lesson.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const storagePath = `grade-${lesson.grade}/${safeSubject}/${lesson.contentId}/elevenlabs-part-1.mp3`;

    const storageUrl = await uploadBinaryToSupabase({
      bucket: process.env.SUPABASE_LESSON_AUDIO_BUCKET ?? "lesson-audio",
      path: storagePath,
      contentType: "audio/mpeg",
      body: mp3,
    });

    const audio = await prisma.lessonAudio.update({
      where: {
        lessonId_contentVersion_voice: {
          lessonId: lesson.contentId,
          contentVersion: lesson.version,
          voice,
        },
      },
      data: {
        status: "GENERATED",
        storageUrl,
        generatedAt: new Date(),
        audioParts: [
          { partNumber: 1, storageUrl, status: "GENERATED", charLength: narrationText.length },
        ],
      },
    });

    void logAudit({
      action: "lesson.audio.regenerated",
      resourceType: "CurriculumContent",
      resourceId: lesson.contentId,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      details: { voice, charLength: narrationText.length, storageUrl },
    });

    return NextResponse.json({ audioUrl: storageUrl, status: "GENERATED", audio });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Audio generation failed" },
      { status: err.status ?? 500 }
    );
  }
}
