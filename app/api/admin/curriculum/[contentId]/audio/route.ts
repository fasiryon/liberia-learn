import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentLessonAudio, queueLessonAudioGeneration } from "@/lib/lessons/audioGeneration";
import { selectStudentLessonAudioText } from "@/lib/curriculum/studentLessonProjection";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, version: true, payload: true, audioAssets: { orderBy: { generatedAt: "desc" }, take: 1 } },
    });
    if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const current = await getCurrentLessonAudio(
      content.contentId,
      content.version,
      undefined,
      selectStudentLessonAudioText(content.payload),
    );
    return NextResponse.json({ status: current.status, audio: current.audio });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Audio status failed" }, { status: error?.status ?? 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("ADMIN", "TEACHER");
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId: params.contentId },
      select: { contentId: true, version: true, payload: true, subject: true },
    });
    if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const lessonText = selectStudentLessonAudioText(content.payload);
    const audio = await queueLessonAudioGeneration({
      lessonId: content.contentId,
      contentVersion: content.version,
      schoolId: user.schoolId ?? null,
      userId: user.id,
      text: lessonText,
    });
    return NextResponse.json({ status: audio.status, audio });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Audio generation failed" }, { status: error?.status ?? 500 });
  }
}
