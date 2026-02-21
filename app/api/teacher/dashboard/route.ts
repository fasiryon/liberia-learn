import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const classes = await prisma.class.findMany({
      where: { schoolId: user.schoolId!, teacherId: user.id },
      select: { id: true, name: true },
    });
    const classIds = classes.map((c) => c.id);

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Today's scheduled work
    const todayWork = await prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, scheduledDate: { gte: startOfDay, lt: endOfDay } },
      select: { id: true, classId: true },
    });

    // Completion count
    const completedCount = todayWork.length > 0
      ? await prisma.studentProgress.count({
          where: {
            scheduledWorkId: { in: todayWork.map((w) => w.id) },
            completedAt: { not: null },
          },
        })
      : 0;

    const totalStudents = await prisma.enrollment.count({ where: { classId: { in: classIds } } });
    const expectedCompletions = todayWork.length * Math.max(totalStudents / Math.max(classIds.length, 1), 1);
    const completionRate = expectedCompletions > 0 ? Math.round((completedCount / expectedCompletions) * 100) : 0;

    // Classes without lesson today
    const classesWithWork = new Set(todayWork.map((w) => w.classId));
    const classesWithoutLesson = classes.filter((c) => !classesWithWork.has(c.id)).map((c) => c.name);

    // Recent published lessons
    const recentLessons = await prisma.curriculumContent.findMany({
      where: { status: "APPROVED" },
      select: { contentId: true, payload: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      scheduledToday: todayWork.length,
      completionRateToday: completionRate,
      classesWithoutLesson,
      recentLessons: recentLessons.map((l) => ({
        contentId: l.contentId,
        title: (l.payload as any)?.title || l.contentId,
        status: l.status,
        createdAt: l.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

