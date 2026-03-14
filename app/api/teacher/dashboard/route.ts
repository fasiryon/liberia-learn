import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const classWhere =
      user.role === "ADMIN"
        ? { schoolId: user.schoolId! }
        : { schoolId: user.schoolId!, teacherId: user.id };

    const classes = await prisma.class.findMany({
      where: classWhere,
      select: { id: true, name: true },
    });
    const classIds = classes.map((c) => c.id);

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    // Today's scheduled work
    const todayWork = await prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, scheduledDate: { gte: startOfDay, lt: endOfDay } },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            teacherId: true,
            Teacher: { select: { name: true } },
          },
        },
        content: {
          select: {
            payload: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
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

    const todayProgress = todayWork.length > 0
      ? await prisma.studentProgress.findMany({
          where: {
            scheduledWorkId: { in: todayWork.map((work) => work.id) },
          },
          select: {
            scheduledWorkId: true,
            startedAt: true,
            completedAt: true,
            exitTicketScore: true,
          },
        })
      : [];

    const progressByWork = new Map<
      string,
      { started: number; completed: number; totalScore: number; scored: number }
    >();
    for (const progress of todayProgress) {
      const current = progressByWork.get(progress.scheduledWorkId) ?? {
        started: 0,
        completed: 0,
        totalScore: 0,
        scored: 0,
      };
      if (progress.startedAt || progress.completedAt) current.started += 1;
      if (progress.completedAt) current.completed += 1;
      if (typeof progress.exitTicketScore === "number") {
        current.totalScore += progress.exitTicketScore;
        current.scored += 1;
      }
      progressByWork.set(progress.scheduledWorkId, current);
    }

    // Classes without lesson today
    const classesWithWork = new Set(todayWork.map((w) => w.classId));
    const classesWithoutLesson = classes.filter((c) => !classesWithWork.has(c.id)).map((c) => c.name);

    const assignmentsPendingGrading = await prisma.assignmentSubmission.count({
      where: {
        score: null,
        turnedInAt: { not: null },
        Assignment: {
          Class: user.role === "ADMIN"
            ? { schoolId: user.schoolId! }
            : { schoolId: user.schoolId!, teacherId: user.id },
        },
      },
    });

    const labsPendingReview = classIds.length > 0
      ? await prisma.labSession.count({
          where: {
            schoolId: user.schoolId!,
            score: null,
            scheduledWorkId: { in: todayWork.map((work) => work.id) },
          },
        })
      : 0;

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
      assignmentsPendingGrading,
      labsPendingReview,
      classesWithoutLesson,
      todayLessons: todayWork.map((work) => {
        const progress = progressByWork.get(work.id) ?? {
          started: 0,
          completed: 0,
          totalScore: 0,
          scored: 0,
        };
        return {
          id: work.id,
          title: (work.content.payload as any)?.title || work.contentId,
          className: work.class.name,
          teacherName: work.class.Teacher?.name ?? "Teacher",
          durationMinutes:
            String(work.classFormat ?? "").startsWith("block") ? 90 : 45,
          status: work.isDelivered ? "delivered" : "pending",
          startedCount: progress.started,
          completedCount: progress.completed,
          averageExitTicketScore: progress.scored > 0 ? Math.round(progress.totalScore / progress.scored) : null,
        };
      }),
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
