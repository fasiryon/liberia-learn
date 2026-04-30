import { prisma } from "@/lib/db";
import { buildStudentExamReadiness } from "@/lib/outcomes/examReadiness";

export type StudentSkillBadge = {
  id: string;
  label: string;
  category: "mastery" | "completion" | "readiness";
  earned: boolean;
  earnedAt: string | null;
  evidence: string[];
  criteria: string;
};

function normalizeScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  return score <= 1 ? Math.round(score * 10000) / 100 : Math.round(score * 100) / 100;
}

function hasMasterySignal(
  profiles: Array<{
    subject: unknown;
    strandKey: string;
    currentScore: number;
    masteryState: unknown;
    lastAssessedAt: Date | null;
  }>,
  matcher: (value: string) => boolean,
  threshold = 80
) {
  const matches = profiles.filter((profile) => {
    const haystack = `${String(profile.subject)} ${profile.strandKey}`.toLowerCase();
    const score = normalizeScore(profile.currentScore);
    const mastered = ["MASTERED", "CONSOLIDATED"].includes(String(profile.masteryState));
    return matcher(haystack) && (mastered || (score != null && score >= threshold));
  });
  return matches;
}

export async function buildStudentSkillBadges(studentId: string): Promise<StudentSkillBadge[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true },
  });

  if (!student) return [];

  const [masteryProfiles, completedProgress, completedLabs, exams, readiness] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      where: { studentId },
      select: { subject: true, strandKey: true, currentScore: true, masteryState: true, lastAssessedAt: true },
    }),
    prisma.studentProgress.findMany({
      where: { studentId: student.userId, completedAt: { not: null } },
      include: { scheduledWork: { include: { content: { select: { subject: true } } } } },
      orderBy: { completedAt: "desc" },
    }),
    prisma.labSession.findMany({
      where: { studentId: student.userId, completedAt: { not: null } },
      select: { id: true, completedAt: true, score: true, labId: true },
      orderBy: { completedAt: "desc" },
    }),
    prisma.examAttempt.findMany({
      where: { studentId, submittedAt: { not: null } },
      include: { exam: { select: { subject: true } } },
      orderBy: { submittedAt: "desc" },
    }),
    buildStudentExamReadiness(studentId),
  ]);

  const fractionMastery = hasMasterySignal(
    masteryProfiles,
    (value) => value.includes("fraction") || value.includes("ratio")
  );
  const readingMastery = hasMasterySignal(
    masteryProfiles,
    (value) => value.includes("reading") || value.includes("comprehension") || value.includes("english")
  );
  const codingMastery = hasMasterySignal(
    masteryProfiles,
    (value) => value.includes("coding") || value.includes("programming") || value.includes("computer")
  );
  const latestCompletion = completedProgress[0]?.completedAt ?? null;
  const latestLab = completedLabs[0]?.completedAt ?? null;
  const readinessEarned = readiness.readinessScore != null && readiness.readinessScore >= 75;
  const passedExam = exams.find((exam) => exam.passed);

  return [
    {
      id: "fractions-mastery",
      label: "Fractions Mastery",
      category: "mastery",
      earned: fractionMastery.length > 0,
      earnedAt: fractionMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      evidence: fractionMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a fractions or ratios strand.",
    },
    {
      id: "reading-comprehension",
      label: "Reading Comprehension",
      category: "mastery",
      earned: readingMastery.length > 0,
      earnedAt: readingMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      evidence: readingMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a reading or comprehension strand.",
    },
    {
      id: "basic-coding",
      label: "Basic Coding",
      category: "mastery",
      earned: codingMastery.length > 0,
      earnedAt: codingMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      evidence: codingMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a coding, programming, or computer strand.",
    },
    {
      id: "science-lab-completion",
      label: "Science Lab Completion",
      category: "completion",
      earned: completedLabs.length > 0,
      earnedAt: latestLab?.toISOString() ?? null,
      evidence: completedLabs.slice(0, 3).map((lab) => `${lab.labId}${lab.score != null ? ` (${lab.score}%)` : ""}`),
      criteria: "Complete at least one assigned lab session.",
    },
    {
      id: "consistent-lesson-completion",
      label: "Consistent Lesson Completion",
      category: "completion",
      earned: completedProgress.length >= 5,
      earnedAt: completedProgress.length >= 5 ? latestCompletion?.toISOString() ?? null : null,
      evidence: [`${completedProgress.length} completed lesson${completedProgress.length === 1 ? "" : "s"}`],
      criteria: "Complete at least five assigned lessons.",
    },
    {
      id: "exam-readiness-milestone",
      label: "Exam Readiness Milestone",
      category: "readiness",
      earned: readinessEarned || Boolean(passedExam),
      earnedAt: passedExam?.submittedAt?.toISOString() ?? readiness.generatedAt,
      evidence: [
        readiness.readinessScore != null ? `${readiness.readinessScore}% readiness score` : "No readiness score yet",
        passedExam ? `Passed ${passedExam.exam.subject} exam` : "",
      ].filter(Boolean),
      criteria: "Reach at least 75% exam readiness or pass a published exam.",
    },
  ];
}
