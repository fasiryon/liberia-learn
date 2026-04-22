import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { queueLessonAudioGeneration } from "@/lib/lessons/audioGeneration";

export const dynamic = "force-dynamic";

function payloadText(payload: unknown) {
  const value = payload as { body_standard?: string; body?: string } | null;
  return value?.body_standard ?? value?.body ?? "";
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(100, Math.max(1, Number(body?.limit ?? 50)));
    const lessons = await prisma.curriculumContent.findMany({
      where: { status: { in: ["APPROVED", "published"] }, contentType: "lesson" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        contentId: true,
        title: true,
        version: true,
        payload: true,
        audioAssets: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          select: { contentVersion: true, status: true },
        },
      },
    });

    let queued = 0;
    let reused = 0;
    for (const lesson of lessons) {
      const current = lesson.audioAssets[0];
      if (current?.contentVersion === lesson.version && current.status === "GENERATED") {
        reused += 1;
        continue;
      }
      const lessonText = payloadText(lesson.payload);
      if (!lessonText.trim()) continue;
      await queueLessonAudioGeneration({
        lessonId: lesson.contentId,
        contentVersion: lesson.version,
        text: lessonText,
        userId: user.id,
        schoolId: user.schoolId ?? null,
      });
      queued += 1;
    }

    return NextResponse.json({ inspected: lessons.length, queued, reused });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Batch audio queue failed" }, { status: error?.status ?? 500 });
  }
}
