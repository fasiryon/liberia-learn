import { prisma } from "@/lib/db";

export type LiveDashboardData = {
  national: {
    activeNow: number;
    totalEnrolled: number;
    schoolsLive: number;
    countiesLive: number;
  };
  today: {
    completionPct: number;
    lessonsOpened: number;
    quizzesSubmitted: number;
  };
  counties: Array<{
    name: string;
    completionPct: number;
    activeStudents: number;
  }>;
  recent: Array<{
    studentInitial: string;
    grade: string;
    lessonTitle: string;
    schoolName: string;
    completedAt: string;
  }>;
  generatedAt: string;
};

function toStudentInitial(fullName: string | null | undefined): string {
  const name = fullName ?? "Student";
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "S";
  const lastInit = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
  return `${first} ${lastInit}`.trim();
}

export async function getLiveDashboardData(): Promise<LiveDashboardData> {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [
    activeNow,
    totalEnrolled,
    schools,
    lessonsOpened,
    quizzesSubmitted,
    scheduledToday,
    deliveredToday,
    recentSessions,
    countyWorkRows,
  ] = await Promise.all([
    prisma.studentSession.count({
      where: { startedAt: { gte: fiveMinAgo } },
    }),
    prisma.student.count(),
    prisma.school.findMany({
      where: { status: "ACTIVE" },
      select: { county: true },
    }),
    prisma.studentSession.count({
      where: { startedAt: { gte: startOfDay } },
    }),
    prisma.homeworkSubmission.count({
      where: { submittedAt: { gte: startOfDay } },
    }),
    prisma.scheduledWork.count({
      where: { scheduledDate: { gte: startOfDay } },
    }),
    prisma.scheduledWork.count({
      where: { scheduledDate: { gte: startOfDay }, isDelivered: true },
    }),
    prisma.studentSession.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            enrollments: {
              take: 1,
              include: {
                Class: {
                  select: {
                    School: { select: { name: true } },
                    gradeLevel: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.scheduledWork.findMany({
      where: { scheduledDate: { gte: startOfDay } },
      select: {
        isDelivered: true,
        class: {
          select: {
            School: { select: { county: true } },
          },
        },
      },
    }),
  ]);

  // Get lesson titles for recent sessions
  const lessonIds = recentSessions.map((s) => s.lessonId);
  const scheduledWorks =
    lessonIds.length > 0
      ? await prisma.scheduledWork.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, content: { select: { title: true } } },
        })
      : [];
  const lessonTitleMap = new Map(
    scheduledWorks.map((sw) => [sw.id, sw.content?.title ?? "Lesson"])
  );

  // Build county completion map
  const countyStats: Record<string, { delivered: number; total: number }> = {};
  for (const row of countyWorkRows) {
    const county = row.class?.School?.county ?? null;
    if (!county) continue;
    countyStats[county] ??= { delivered: 0, total: 0 };
    countyStats[county].total++;
    if (row.isDelivered) countyStats[county].delivered++;
  }

  const counties = Object.entries(countyStats)
    .map(([name, stats]) => ({
      name,
      completionPct: stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0,
      activeStudents: 0,
    }))
    .sort((a, b) => b.completionPct - a.completionPct || a.name.localeCompare(b.name))
    .slice(0, 5);

  const recent = recentSessions.map((s) => {
    const enrollment = s.student.enrollments[0];
    const schoolName = enrollment?.Class?.School?.name ?? "Unknown School";
    const grade = enrollment?.Class?.gradeLevel
      ? `G${enrollment.Class.gradeLevel}`
      : s.student.currentGrade
        ? `G${s.student.currentGrade}`
        : "—";
    return {
      studentInitial: toStudentInitial(s.student.user.name),
      grade,
      lessonTitle: lessonTitleMap.get(s.lessonId) ?? "Lesson",
      schoolName,
      completedAt: s.startedAt.toISOString(),
    };
  });

  const countySet = new Set(schools.map((s) => s.county).filter(Boolean));

  return {
    national: {
      activeNow,
      totalEnrolled,
      schoolsLive: schools.length,
      countiesLive: countySet.size,
    },
    today: {
      completionPct:
        scheduledToday > 0 ? Math.round((deliveredToday / scheduledToday) * 100) : 0,
      lessonsOpened,
      quizzesSubmitted,
    },
    counties,
    recent,
    generatedAt: new Date().toISOString(),
  };
}
