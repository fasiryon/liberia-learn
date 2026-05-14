import { prisma } from "@/lib/db";

export type LeaderboardEntry = {
  studentId: string;
  firstName: string;
  score: number;
  lessonsCompleted: number;
  quizAvg: number;
  rank: number;
};

export type LeaderboardResult = {
  classId: string;
  schoolId: string;
  weekStart: string;
  entries: LeaderboardEntry[];
};

function getWeekStart(): Date {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export async function buildWeeklyLeaderboard(
  classId: string,
  schoolId: string
): Promise<LeaderboardResult> {
  const weekStart = getWeekStart();

  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    select: {
      Student: {
        select: {
          id: true,
          userId: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const entries: LeaderboardEntry[] = [];

  for (const e of enrollments) {
    const streak = await prisma.studentStreak.findUnique({
      where: { studentId: e.Student.userId },
      select: { optOut: true },
    });
    if (streak?.optOut) continue;

    const [lessonsCompleted, attempts] = await Promise.all([
      prisma.learningEvent
        ? (prisma as any).learningEvent.count({
            where: {
              userId: e.Student.userId,
              eventType: "lesson.completed",
              createdAt: { gte: weekStart },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
      prisma.assessmentAttempt.findMany({
        where: {
          userId: e.Student.userId,
          createdAt: { gte: weekStart },
        },
        select: { score: true, maxScore: true },
      }),
    ]);

    const quizAvg =
      attempts.length > 0
        ? (attempts.reduce(
            (sum: number, a: { score: number | null; maxScore: number | null }) =>
              sum + (a.score ?? 0) / (a.maxScore ?? 1),
            0
          ) /
            attempts.length) *
          100
        : 0;

    const score = (lessonsCompleted as number) * 10 + quizAvg * 0.5;
    entries.push({
      studentId: e.Student.userId,
      firstName: (e.Student.user.name ?? "Student").split(" ")[0],
      score: Math.round(score),
      lessonsCompleted: lessonsCompleted as number,
      quizAvg: Math.round(quizAvg),
      rank: 0,
    });
  }

  entries.sort((a, b) => b.score - a.score);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });

  await prisma.weeklyLeaderboard.upsert({
    where: { classId_weekStart: { classId, weekStart } },
    create: { classId, schoolId, weekStart, entries: entries as any },
    update: { entries: entries as any },
  });

  return {
    classId,
    schoolId,
    weekStart: weekStart.toISOString(),
    entries,
  };
}
