import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");

    // Find student's enrolled classes
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, enrollments: { select: { classId: true } } },
    });

    if (!student) {
      return NextResponse.json({ items: [] });
    }

    const classIds = student.enrollments.map((e) => e.classId);
    if (classIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Today's date range (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const scheduledWork = await prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        scheduledDate: { gte: startOfDay, lt: endOfDay },
      },
      include: {
        content: {
          select: {
            contentId: true,
            grade: true,
            subject: true,
            contentType: true,
            payload: true,
          },
        },
        progress: {
          where: { studentId: user.id },
          select: { completedAt: true, startedAt: true },
        },
      },
      orderBy: { periodNumber: "asc" },
    });

    const items = scheduledWork.map((sw) => {
      const payload = sw.content.payload as any;
      const progress = sw.progress[0];
      let status: "not_started" | "in_progress" | "completed" = "not_started";
      if (progress?.completedAt) status = "completed";
      else if (progress?.startedAt) status = "in_progress";

      return {
        id: sw.id,
        title: payload?.title || payload?.topic || `${sw.content.subject} Lesson`,
        subject: sw.content.subject,
        contentType: sw.content.contentType,
        estimatedDuration: payload?.durationMins || 45,
        periodNumber: sw.periodNumber,
        startTime: sw.startTime,
        endTime: sw.endTime,
        status,
        completedAt: progress?.completedAt || null,
      };
    });

    return NextResponse.json({ items });
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

