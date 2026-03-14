import { prisma } from "@/lib/db";

export type MasteryGap = {
  strand: string;
  subject: string;
  grade: number;
  averageScore: number;
  attemptCount: number;
  lastAttemptAt: Date;
};

type GapAccumulator = {
  strand: string;
  subject: string;
  grade: number;
  totalScore: number;
  attemptCount: number;
  lastAttemptAt: Date;
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function detectMasteryGaps(studentId: string): Promise<MasteryGap[]> {
  const [student, attempts, masteryProfiles] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentGrade: true },
    }),
    (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId },
      orderBy: { completedAt: "desc" },
    }),
    prisma.studentMasteryProfile.findMany({
      where: { studentId, lastAssessedAt: { not: null } },
      select: {
        subject: true,
        strandKey: true,
        currentScore: true,
        lastAssessedAt: true,
      },
    }),
  ]);

  const grade = student?.currentGrade ?? 0;
  const grouped = new Map<string, GapAccumulator>();

  for (const attempt of attempts as Array<{
    strandCode: string;
    subject: string;
    grade: number;
    score: number;
    completedAt: Date;
  }>) {
    const key = `${attempt.subject}::${attempt.strandCode}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.totalScore += attempt.score;
      existing.attemptCount += 1;
      if (attempt.completedAt > existing.lastAttemptAt) {
        existing.lastAttemptAt = attempt.completedAt;
      }
      continue;
    }

    grouped.set(key, {
      strand: attempt.strandCode,
      subject: attempt.subject,
      grade: attempt.grade,
      totalScore: attempt.score,
      attemptCount: 1,
      lastAttemptAt: attempt.completedAt,
    });
  }

  for (const profile of masteryProfiles) {
    const key = `${profile.subject}::${profile.strandKey}`;
    if (grouped.has(key) || !profile.lastAssessedAt) {
      continue;
    }

    grouped.set(key, {
      strand: profile.strandKey,
      subject: String(profile.subject),
      grade,
      totalScore: profile.currentScore,
      attemptCount: 1,
      lastAttemptAt: profile.lastAssessedAt,
    });
  }

  return [...grouped.values()]
    .map((entry) => ({
      strand: entry.strand,
      subject: entry.subject,
      grade: entry.grade,
      averageScore: round4(entry.totalScore / entry.attemptCount),
      attemptCount: entry.attemptCount,
      lastAttemptAt: entry.lastAttemptAt,
    }))
    .filter((gap) => gap.attemptCount >= 1 && gap.averageScore < 0.7)
    .sort((a, b) => a.averageScore - b.averageScore);
}
