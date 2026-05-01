import { prisma } from "@/lib/db";
import { buildStudentExamReadiness } from "@/lib/outcomes/examReadiness";

export const STUDENT_BADGE_CRITERIA_VERSION = "v1";

export type StudentSkillBadge = {
  id: string;
  label: string;
  description: string;
  category: "mastery" | "completion" | "readiness";
  earned: boolean;
  earnedAt: string | null;
  awardId: string | null;
  criteriaVersion: string;
  evidenceType: string;
  evidenceId: string | null;
  evidence: string[];
  criteria: string;
};

type StudentSkillBadgeEligibility = Omit<StudentSkillBadge, "awardId">;

type StudentBadgeAwardRecord = {
  id: string;
  badgeKey: string;
  awardedAt: Date;
  criteriaVersion: string;
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
  return syncStudentBadgeAwards(studentId);
}

export async function computeStudentSkillBadgeEligibility(
  studentId: string
): Promise<StudentSkillBadgeEligibility[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true },
  });

  if (!student) return [];

  const masteryProfiles = await prisma.studentMasteryProfile.findMany({
    where: { studentId },
    select: { subject: true, strandKey: true, currentScore: true, masteryState: true, lastAssessedAt: true },
  });
  const completedProgress = await prisma.studentProgress.findMany({
    where: { studentId: student.userId, completedAt: { not: null } },
    include: { scheduledWork: { include: { content: { select: { subject: true } } } } },
    orderBy: { completedAt: "desc" },
  });
  const completedLabs = await prisma.labSession.findMany({
    where: { studentId: student.userId, completedAt: { not: null } },
    select: { id: true, completedAt: true, score: true, labId: true },
    orderBy: { completedAt: "desc" },
  });
  const exams = await prisma.examAttempt.findMany({
    where: { studentId, submittedAt: { not: null } },
    include: { exam: { select: { subject: true } } },
    orderBy: { submittedAt: "desc" },
  });
  const readiness = await buildStudentExamReadiness(studentId);

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
      description: "Recognizes demonstrated mastery of fractions or ratio concepts.",
      category: "mastery",
      earned: fractionMastery.length > 0,
      earnedAt: fractionMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: "mastery_profile",
      evidenceId: fractionMastery[0]?.strandKey ?? null,
      evidence: fractionMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a fractions or ratios strand.",
    },
    {
      id: "reading-comprehension",
      label: "Reading Comprehension",
      description: "Recognizes strong reading or comprehension mastery signals.",
      category: "mastery",
      earned: readingMastery.length > 0,
      earnedAt: readingMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: "mastery_profile",
      evidenceId: readingMastery[0]?.strandKey ?? null,
      evidence: readingMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a reading or comprehension strand.",
    },
    {
      id: "basic-coding",
      label: "Basic Coding",
      description: "Recognizes early coding, programming, or computing readiness.",
      category: "mastery",
      earned: codingMastery.length > 0,
      earnedAt: codingMastery[0]?.lastAssessedAt?.toISOString() ?? null,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: "mastery_profile",
      evidenceId: codingMastery[0]?.strandKey ?? null,
      evidence: codingMastery.slice(0, 3).map((profile) => `${String(profile.subject)} ${profile.strandKey}`),
      criteria: "Earn mastery or at least 80% on a coding, programming, or computer strand.",
    },
    {
      id: "science-lab-completion",
      label: "Science Lab Completion",
      description: "Recognizes completion of a science lab activity.",
      category: "completion",
      earned: completedLabs.length > 0,
      earnedAt: latestLab?.toISOString() ?? null,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: "lab_session",
      evidenceId: completedLabs[0]?.id ?? null,
      evidence: completedLabs.slice(0, 3).map((lab) => `${lab.labId}${lab.score != null ? ` (${lab.score}%)` : ""}`),
      criteria: "Complete at least one assigned lab session.",
    },
    {
      id: "consistent-lesson-completion",
      label: "Consistent Lesson Completion",
      description: "Recognizes steady completion of assigned lessons.",
      category: "completion",
      earned: completedProgress.length >= 5,
      earnedAt: completedProgress.length >= 5 ? latestCompletion?.toISOString() ?? null : null,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: "student_progress",
      evidenceId: null,
      evidence: [`${completedProgress.length} completed lesson${completedProgress.length === 1 ? "" : "s"}`],
      criteria: "Complete at least five assigned lessons.",
    },
    {
      id: "exam-readiness-milestone",
      label: "Exam Readiness Milestone",
      description: "Recognizes readiness for upcoming exams from readiness or exam evidence.",
      category: "readiness",
      earned: readinessEarned || Boolean(passedExam),
      earnedAt: passedExam?.submittedAt?.toISOString() ?? readiness.generatedAt,
      criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION,
      evidenceType: passedExam ? "exam_attempt" : "exam_readiness",
      evidenceId: passedExam?.id ?? null,
      evidence: [
        readiness.readinessScore != null ? `${readiness.readinessScore}% readiness score` : "No readiness score yet",
        passedExam ? `Passed ${passedExam.exam.subject} exam` : "",
      ].filter(Boolean),
      criteria: "Reach at least 75% exam readiness or pass a published exam.",
    },
  ];
}

function fallbackAwardDate(badge: StudentSkillBadgeEligibility): Date {
  if (badge.earnedAt) {
    const parsed = new Date(badge.earnedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function withAward(
  badge: StudentSkillBadgeEligibility,
  award: StudentBadgeAwardRecord | null
): StudentSkillBadge {
  return {
    ...badge,
    awardId: award?.id ?? null,
    earnedAt: award?.awardedAt.toISOString() ?? badge.earnedAt,
    criteriaVersion: award?.criteriaVersion ?? badge.criteriaVersion,
  };
}

export async function syncStudentBadgeAwards(studentId: string): Promise<StudentSkillBadge[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, user: { select: { schoolId: true } } },
  });

  if (!student) return [];

  const [eligibleBadges, existingAwards] = await Promise.all([
    computeStudentSkillBadgeEligibility(studentId),
    prisma.studentBadgeAward.findMany({
      where: { studentId, criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION },
      select: { id: true, badgeKey: true, awardedAt: true, criteriaVersion: true },
    }),
  ]);

  const awardsByKey = new Map(existingAwards.map((award) => [award.badgeKey, award]));
  for (const badge of eligibleBadges) {
    if (!badge.earned || awardsByKey.has(badge.id)) continue;

    try {
      const award = await prisma.studentBadgeAward.create({
        data: {
          schoolId: student.user.schoolId,
          studentId,
          badgeKey: badge.id,
          title: badge.label,
          description: badge.description,
          evidenceType: badge.evidenceType,
          evidenceId: badge.evidenceId,
          evidenceSummary: { evidence: badge.evidence, criteria: badge.criteria },
          awardedAt: fallbackAwardDate(badge),
          criteriaVersion: badge.criteriaVersion,
        },
        select: { id: true, badgeKey: true, awardedAt: true, criteriaVersion: true },
      });
      awardsByKey.set(award.badgeKey, award);
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      const existing = await prisma.studentBadgeAward.findFirst({
        where: { studentId, badgeKey: badge.id, criteriaVersion: badge.criteriaVersion },
        select: { id: true, badgeKey: true, awardedAt: true, criteriaVersion: true },
      });
      if (existing) awardsByKey.set(existing.badgeKey, existing);
    }
  }

  return eligibleBadges.map((badge) => withAward(badge, awardsByKey.get(badge.id) ?? null));
}

export async function backfillStudentBadgeAwards(studentIds: string[]): Promise<{
  processed: number;
  awarded: number;
}> {
  let awarded = 0;
  for (const studentId of studentIds) {
    const before = await prisma.studentBadgeAward.count({
      where: { studentId, criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION },
    });
    await syncStudentBadgeAwards(studentId);
    const after = await prisma.studentBadgeAward.count({
      where: { studentId, criteriaVersion: STUDENT_BADGE_CRITERIA_VERSION },
    });
    awarded += Math.max(0, after - before);
  }
  return { processed: studentIds.length, awarded };
}
