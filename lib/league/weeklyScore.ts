import { prisma } from "@/lib/db";

const PTS_LESSON = Number(process.env.LEAGUE_POINTS_LESSON ?? 10);
const PTS_QUIZ_HIGH = Number(process.env.LEAGUE_POINTS_QUIZ_HIGH ?? 5);
const PTS_CERT = Number(process.env.LEAGUE_POINTS_CERT ?? 15);
const PTS_STREAK = Number(process.env.LEAGUE_POINTS_STREAK ?? 20);
const MIN_ENROLLMENT = 10;

export interface WeekWindow {
  weekStart: Date;
  weekEnd: Date;
}

export function currentWeekWindow(): WeekWindow {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(monday.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 7);
  return { weekStart: monday, weekEnd: sunday };
}

export function previousWeekWindow(): WeekWindow {
  const { weekStart } = currentWeekWindow();
  const prevMonday = new Date(weekStart);
  prevMonday.setUTCDate(weekStart.getUTCDate() - 7);
  return { weekStart: prevMonday, weekEnd: weekStart };
}

export interface SchoolWeekScore {
  schoolId: string;
  schoolName: string;
  district: string;
  pointsTotal: number;
  enrollmentCount: number;
  score: number;
}

export async function computeSchoolWeeklyScores(
  window: WeekWindow
): Promise<SchoolWeekScore[]> {
  const schools = await prisma.school.findMany({
    where: { status: "ACTIVE", district: { not: null } },
    select: { id: true, name: true, district: true },
  });

  const results: SchoolWeekScore[] = [];

  for (const school of schools) {
    try {
      const [lessonsCompleted, highScoreQuizzes, certsEarned, streakStudents, enrollment] =
        await Promise.all([
          prisma.studentProgress.count({
            where: {
              scheduledWork: { class: { schoolId: school.id } },
              completedAt: { gte: window.weekStart, lt: window.weekEnd },
            },
          }),
          prisma.studentProgress.count({
            where: {
              scheduledWork: { class: { schoolId: school.id } },
              completedAt: { gte: window.weekStart, lt: window.weekEnd },
              exitTicketScore: { gte: 80 },
            },
          }),
          prisma.portfolioCredential.count({
            where: {
              student: { schoolId: school.id },
              generatedAt: { gte: window.weekStart, lt: window.weekEnd },
            },
          }),
          prisma.studentStreak.count({
            where: {
              student: { schoolId: school.id },
              currentStreak: { gte: 5 },
            },
          }),
          prisma.user.count({
            where: { schoolId: school.id, role: "STUDENT" },
          }),
        ]);

      const pointsTotal =
        lessonsCompleted * PTS_LESSON +
        highScoreQuizzes * PTS_QUIZ_HIGH +
        certsEarned * PTS_CERT +
        streakStudents * PTS_STREAK;

      const effectiveEnrollment = Math.max(enrollment, MIN_ENROLLMENT);
      const score = pointsTotal / effectiveEnrollment;

      results.push({
        schoolId: school.id,
        schoolName: school.name,
        district: school.district!,
        pointsTotal,
        enrollmentCount: enrollment,
        score,
      });
    } catch {
      // skip failed schools
    }
  }

  return results;
}

export function assignDistrictRanks(
  scores: SchoolWeekScore[]
): Array<SchoolWeekScore & { rank: number }> {
  const byDistrict: Record<string, SchoolWeekScore[]> = {};
  for (const s of scores) {
    if (!byDistrict[s.district]) byDistrict[s.district] = [];
    byDistrict[s.district].push(s);
  }

  const result: Array<SchoolWeekScore & { rank: number }> = [];
  for (const list of Object.values(byDistrict)) {
    list.sort((a, b) => b.score - a.score);
    list.forEach((s, i) => result.push({ ...s, rank: i + 1 }));
  }
  return result;
}
