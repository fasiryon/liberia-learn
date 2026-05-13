import { prisma } from "@/lib/db";

export interface PortfolioSummary {
  studentId: string;
  userId: string;
  firstName: string;
  fullName: string | null;
  gradeLevel: number | null;
  schoolName: string | null;
  lessonsCompleted: number;
  quizAverage: number | null;
  certificatesEarned: number;
  badgesEarned: number;
  labSessions: number;
  dayStreak: number;
  assignmentAverage: number | null;
  discussionContributions: number;
  subjectsStudied: string[];
  badges: { key: string; title: string }[];
  certificates: { id: string; type: string; awardedAt: Date; certificateCode: string; canvaUrl: string | null }[];
  capstoneProjects: { id: string; title: string; status: string; submittedAt: Date | null }[];
}

export async function buildPortfolioSummary(studentId: string): Promise<PortfolioSummary> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { id: true, name: true, schoolId: true } },
    },
  });
  if (!student) throw new Error("Student not found");

  const schoolName = student.user.schoolId
    ? await prisma.school.findUnique({ where: { id: student.user.schoolId }, select: { name: true } }).then((s) => s?.name ?? null)
    : null;

  const [
    learningEvents,
    assessmentAttempts,
    assignmentSubmissions,
    certificates,
    badges,
    capstoneProjects,
    discussionPosts,
    labEvents,
  ] = await Promise.all([
    prisma.learningEvent.findMany({
      where: { studentId, status: { in: ["accepted", "delivered", "completed"] } },
      select: { eventType: true, occurredAt: true, metadata: true },
      orderBy: { occurredAt: "desc" },
    }),
    (prisma as any).assessmentAttempt.findMany({
      where: { studentId, status: "completed", score: { not: null } },
      select: { score: true, maxScore: true },
    }),
    (prisma as any).assignmentSubmission.findMany({
      where: { Student: { userId: student.userId }, score: { not: null } },
      select: { score: true },
    }),
    prisma.certificate.findMany({
      where: { studentId, status: "completed" },
      select: { id: true, type: true, awardedAt: true, certificateCode: true, canvaUrl: true },
    }),
    (prisma as any).studentBadgeAward.findMany({
      where: { studentId },
      select: { badgeKey: true, title: true, awardedAt: true },
      orderBy: { awardedAt: "desc" },
    }),
    (prisma as any).capstoneProject.findMany({
      where: { studentId, status: { in: ["SUBMITTED", "APPROVED", "REJECTED"] } },
      select: { id: true, title: true, status: true, submittedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    (prisma as any).discussionPost.findMany({
      where: { authorId: student.userId },
      select: { id: true },
    }),
    prisma.learningEvent.findMany({
      where: { studentId, eventType: "lab.session.started" },
      select: { id: true },
    }),
  ]);

  const lessonCompleteEvents = learningEvents.filter(
    (e) => e.eventType === "lesson.completed" || e.eventType === "lesson.delivered"
  );
  const lessonsCompleted = lessonCompleteEvents.length;

  const subjects = Array.from(
    new Set(
      learningEvents
        .map((e) => (e.metadata as any)?.subject as string | undefined)
        .filter((s): s is string => Boolean(s))
    )
  );

  const quizAverage =
    assessmentAttempts.length > 0
      ? Number(
          (
            assessmentAttempts.reduce((sum: number, a: any) => {
              const max = a.maxScore ?? 1;
              return sum + (max > 0 ? a.score / max : 0);
            }, 0) / assessmentAttempts.length
          ).toFixed(3)
        )
      : null;

  const assignmentAverage =
    assignmentSubmissions.length > 0
      ? Number(
          (
            assignmentSubmissions.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0) /
            assignmentSubmissions.length
          ).toFixed(1)
        )
      : null;

  const dayStreak = computeStreak(learningEvents.map((e) => e.occurredAt));

  const nameParts = (student.user.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "Student";

  return {
    studentId,
    userId: student.userId,
    firstName,
    fullName: student.user.name ?? null,
    gradeLevel: student.currentGrade ?? null,
    schoolName,
    lessonsCompleted,
    quizAverage,
    certificatesEarned: certificates.length,
    badgesEarned: badges.length,
    labSessions: labEvents.length,
    dayStreak,
    assignmentAverage,
    discussionContributions: discussionPosts.length,
    subjectsStudied: subjects,
    badges: badges.map((b: any) => ({ key: b.badgeKey, title: b.title })),
    certificates: certificates.map((c) => ({
      id: c.id,
      type: String(c.type),
      awardedAt: c.awardedAt,
      certificateCode: c.certificateCode,
      canvaUrl: c.canvaUrl ?? null,
    })),
    capstoneProjects: capstoneProjects.map((c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      submittedAt: c.submittedAt ?? null,
    })),
  };
}

function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = Array.from(
    new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)))
  ).sort((a, b) => (a < b ? 1 : -1));

  let streak = 1;
  for (let i = 0; i < days.length - 1; i++) {
    const curr = new Date(days[i]);
    const next = new Date(days[i + 1]);
    const diff = (curr.getTime() - next.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
