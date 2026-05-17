import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await requireRole("STUDENT");

    const body = await req.json().catch(() => ({}));
    const watchedSecs = Number(body?.watchedSecs ?? 0);
    const totalSecs = Number(body?.totalSecs ?? 0);

    if (watchedSecs < 0 || totalSecs <= 0) {
      return NextResponse.json({ error: "Invalid watch data" }, { status: 400 });
    }

    const video = await prisma.lessonVideo.findUnique({
      where: { id: params.videoId },
      select: { id: true, status: true, viewCount: true },
    });

    if (!video || video.status !== "APPROVED") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isCompleted = totalSecs > 0 && watchedSecs >= totalSecs * 0.9;

    // Upsert watch event
    const existing = await prisma.videoWatchEvent.findUnique({
      where: { videoId_studentId: { videoId: params.videoId, studentId: user.id } },
      select: { id: true, completedAt: true },
    });

    const wasAlreadyCompleted = Boolean(existing?.completedAt);

    await prisma.videoWatchEvent.upsert({
      where: { videoId_studentId: { videoId: params.videoId, studentId: user.id } },
      create: {
        videoId: params.videoId,
        studentId: user.id,
        watchedSecs,
        totalSecs,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        watchedSecs: Math.max(watchedSecs, existing?.completedAt ? watchedSecs : watchedSecs),
        totalSecs,
        completedAt: isCompleted && !wasAlreadyCompleted ? new Date() : existing?.completedAt ?? null,
      },
    });

    // Increment viewCount on first completion
    if (isCompleted && !wasAlreadyCompleted) {
      await prisma.lessonVideo.update({
        where: { id: params.videoId },
        data: { viewCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
