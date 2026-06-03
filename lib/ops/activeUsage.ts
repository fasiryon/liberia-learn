import { prisma } from "@/lib/db";

export type UsageSnapshot = {
  activeSessionsLast5Min: number;
  submissionsLastHour: number;
  stuckEventsLastHour: number;
  mostStuckLessonToday: { lessonId: string; count: number } | null;
};

export async function getActiveUsage(): Promise<UsageSnapshot> {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000);
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  try {
    const [activeSessions, homeworkSubs, gradedSubs, stuckEvents, stuckByLesson] =
      await Promise.all([
        prisma.studentSession.count({
          where: { startedAt: { gte: fiveMinAgo } },
        }),
        prisma.homeworkSubmission.count({
          where: { submittedAt: { gte: oneHourAgo } },
        }),
        (prisma as any).gradedSubmission
          ? (prisma as any).gradedSubmission.count({
              where: { createdAt: { gte: oneHourAgo } },
            })
          : Promise.resolve(0),
        prisma.stuckEvent.count({
          where: { createdAt: { gte: oneHourAgo } },
        }),
        prisma.stuckEvent.groupBy({
          by: ["lessonId"],
          where: { createdAt: { gte: startOfDay } },
          _count: { lessonId: true },
          orderBy: { _count: { lessonId: "desc" } },
          take: 1,
        }),
      ]);

    const top = stuckByLesson[0];

    return {
      activeSessionsLast5Min: activeSessions,
      submissionsLastHour: homeworkSubs + (gradedSubs as number),
      stuckEventsLastHour: stuckEvents,
      mostStuckLessonToday: top
        ? { lessonId: top.lessonId, count: top._count.lessonId }
        : null,
    };
  } catch {
    return {
      activeSessionsLast5Min: 0,
      submissionsLastHour: 0,
      stuckEventsLastHour: 0,
      mostStuckLessonToday: null,
    };
  }
}
