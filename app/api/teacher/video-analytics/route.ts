import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const user = await requireRole("TEACHER");

    const videos = await prisma.lessonVideo.findMany({
      where: {
        uploadedBy: user.id,
        status: "APPROVED",
      },
      orderBy: { approvedAt: "desc" },
      select: {
        id: true,
        title: true,
        durationSeconds: true,
        viewCount: true,
        uploadedAt: true,
        approvedAt: true,
        lessonId: true,
        lesson: {
          select: {
            subject: true,
            grade: true,
          },
        },
        watchEvents: {
          select: {
            watchedSecs: true,
            totalSecs: true,
            completedAt: true,
            studentId: true,
          },
        },
      },
    });

    const analytics = videos.map((v) => {
      const events = v.watchEvents;
      const totalWatchers = events.length;
      const avgWatchedSecs =
        totalWatchers > 0
          ? Math.round(events.reduce((s, e) => s + e.watchedSecs, 0) / totalWatchers)
          : 0;
      const avgPct =
        v.durationSeconds > 0
          ? Math.round((avgWatchedSecs / v.durationSeconds) * 100)
          : 0;
      const completedCount = events.filter((e) => e.completedAt).length;
      const dropOffRate =
        totalWatchers > 0
          ? Math.round(((totalWatchers - completedCount) / totalWatchers) * 100)
          : 0;
      const didntFinish = events
        .filter((e) => e.watchedSecs < (v.durationSeconds ?? 0) * 0.5)
        .map((e) => e.studentId);

      return {
        id: v.id,
        title: v.title,
        lessonId: v.lessonId,
        subject: v.lesson.subject,
        grade: v.lesson.grade,
        durationSeconds: v.durationSeconds,
        viewCount: v.viewCount,
        totalWatchers,
        avgWatchedSecs,
        avgWatchPct: avgPct,
        dropOffRate,
        didntFinishStudentIds: didntFinish,
        uploadedAt: v.uploadedAt,
        approvedAt: v.approvedAt,
      };
    });

    return NextResponse.json({ analytics });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
