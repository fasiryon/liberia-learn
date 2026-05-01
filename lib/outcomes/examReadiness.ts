import { prisma } from "@/lib/db";

export type SubjectExamReadiness = {
  subject: string;
  score: number;
  evidenceCount: number;
  masteryScore: number | null;
  completionScore: number | null;
  assessmentScore: number | null;
  examScore: number | null;
  weakTopics: string[];
};

export type StudentExamReadiness = {
  studentId: string;
  generatedAt: string;
  readinessScore: number | null;
  strongSubjects: string[];
  weakSubjects: string[];
  recommendedPractice: string[];
  nextBestAction: {
    label: string;
    href: string;
    reason: string;
  } | null;
  subjects: SubjectExamReadiness[];
};

export type TeacherExamReadinessSummary = {
  generatedAt: string;
  classSummaries: Array<{
    classId: string;
    className: string;
    subject: string;
    gradeLevel: number | null;
    studentCount: number;
    averageReadiness: number | null;
    weakTopics: string[];
    studentsNeedingSupport: Array<{
      studentId: string;
      name: string | null;
      readinessScore: number | null;
    }>;
  }>;
};

export type MoeOutcomesSummary = {
  generatedAt: string;
  readinessBySubject: Array<{
    subject: string;
    studentCount: number;
    suppressed: boolean;
    averageReadiness: number | null;
  }>;
  badgeAwardsByKey: Array<{
    badgeKey: string;
    awardCount: number;
  }>;
};

const MIN_AGGREGATE_COHORT = 5;

function normalizeScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(score)) return null;
  const pct = score <= 1 ? score * 100 : score;
  return Math.round(Math.max(0, Math.min(100, pct)) * 100) / 100;
}

function average(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (usable.length === 0) return null;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 100) / 100;
}

function weightedAverage(parts: Array<{ value: number | null; weight: number }>): number | null {
  const usable = parts.filter((part) => part.value != null);
  const totalWeight = usable.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return null;
  return Math.round(
    (usable.reduce((sum, part) => sum + Number(part.value) * part.weight, 0) / totalWeight) * 100
  ) / 100;
}

function labelSubject(subject: string): string {
  return subject.replace(/_/g, " ");
}

export async function buildStudentExamReadiness(studentId: string): Promise<StudentExamReadiness> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      userId: true,
      currentGrade: true,
      user: { select: { schoolId: true } },
    },
  });

  if (!student) {
    return {
      studentId,
      generatedAt: new Date().toISOString(),
      readinessScore: null,
      strongSubjects: [],
      weakSubjects: [],
      recommendedPractice: [],
      nextBestAction: null,
      subjects: [],
    };
  }

  const [masteryProfiles, progress, assessments, examAttempts] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      where: { studentId },
      select: { subject: true, strandKey: true, currentScore: true, masteryState: true },
    }),
    prisma.studentProgress.findMany({
      where: { studentId: student.userId },
      include: {
        scheduledWork: {
          include: { content: { select: { subject: true } } },
        },
      },
    }),
    prisma.assessmentAttempt.findMany({
      where: {
        OR: [{ studentId }, { userId: student.userId }],
        status: "completed",
      },
      select: { subject: true, score: true, maxScore: true, submittedAt: true, attemptedAt: true },
    }),
    prisma.examAttempt.findMany({
      where: { studentId, submittedAt: { not: null } },
      include: { exam: { select: { subject: true } } },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const subjects = new Set<string>();
  masteryProfiles.forEach((profile) => subjects.add(String(profile.subject)));
  progress.forEach((item) => subjects.add(String(item.scheduledWork.content.subject)));
  assessments.forEach((attempt) => {
    if (attempt.subject) subjects.add(attempt.subject);
  });
  examAttempts.forEach((attempt) => subjects.add(attempt.exam.subject));

  const subjectReadiness: SubjectExamReadiness[] = Array.from(subjects).map((subject) => {
    const masteryForSubject = masteryProfiles.filter((profile) => String(profile.subject) === subject);
    const progressForSubject = progress.filter((item) => String(item.scheduledWork.content.subject) === subject);
    const assessmentsForSubject = assessments.filter((attempt) => attempt.subject === subject);
    const examsForSubject = examAttempts.filter((attempt) => attempt.exam.subject === subject);

    const masteryScore = average(masteryForSubject.map((profile) => normalizeScore(profile.currentScore)));
    const completed = progressForSubject.filter((item) => item.completedAt).length;
    const completionScore =
      progressForSubject.length > 0 ? Math.round((completed / progressForSubject.length) * 10000) / 100 : null;
    const assessmentScore = average(
      assessmentsForSubject.map((attempt) => {
        if (attempt.score == null) return null;
        if (attempt.maxScore && attempt.maxScore > 0) {
          return normalizeScore(attempt.score / attempt.maxScore);
        }
        return normalizeScore(attempt.score);
      })
    );
    const examScore = average(examsForSubject.map((attempt) => normalizeScore(attempt.score)));
    const score = weightedAverage([
      { value: masteryScore, weight: 0.45 },
      { value: assessmentScore, weight: 0.25 },
      { value: completionScore, weight: 0.2 },
      { value: examScore, weight: 0.1 },
    ]);
    const weakTopics = masteryForSubject
      .filter((profile) => {
        const normalized = normalizeScore(profile.currentScore);
        return normalized != null && normalized < 60;
      })
      .map((profile) => profile.strandKey)
      .slice(0, 4);

    return {
      subject,
      score: score ?? 0,
      evidenceCount:
        masteryForSubject.length + progressForSubject.length + assessmentsForSubject.length + examsForSubject.length,
      masteryScore,
      completionScore,
      assessmentScore,
      examScore,
      weakTopics,
    };
  });

  const readinessScore = average(subjectReadiness.filter((s) => s.evidenceCount > 0).map((s) => s.score));
  const strongSubjects = subjectReadiness
    .filter((subject) => subject.evidenceCount > 0 && subject.score >= 75)
    .map((subject) => subject.subject);
  const weakSubjects = subjectReadiness
    .filter((subject) => subject.evidenceCount > 0 && subject.score < 60)
    .map((subject) => subject.subject);
  const lowest = subjectReadiness
    .filter((subject) => subject.evidenceCount > 0)
    .sort((a, b) => a.score - b.score)[0];

  return {
    studentId,
    generatedAt: new Date().toISOString(),
    readinessScore,
    strongSubjects,
    weakSubjects,
    recommendedPractice: lowest
      ? [
          lowest.weakTopics[0]
            ? `${labelSubject(lowest.subject)}: review ${lowest.weakTopics[0]}`
            : `${labelSubject(lowest.subject)}: complete recommended practice`,
        ]
      : [],
    nextBestAction: lowest
      ? {
          label: `Practice ${labelSubject(lowest.subject)}`,
          href: "/student/adaptive",
          reason:
            lowest.score < 60
              ? "This subject has the weakest readiness signal."
              : "Keep this subject strong before the next exam.",
        }
      : null,
    subjects: subjectReadiness.sort((a, b) => a.subject.localeCompare(b.subject)),
  };
}

export async function buildTeacherExamReadinessSummary(
  teacherUserId: string,
  schoolId: string
): Promise<TeacherExamReadinessSummary> {
  const classes = await prisma.class.findMany({
    where: { teacherId: teacherUserId, schoolId },
    include: {
      enrollments: {
        include: {
          Student: {
            select: {
              id: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const classSummaries = await Promise.all(
    classes.map(async (klass) => {
      const studentReadiness = await Promise.all(
        klass.enrollments.map(async (enrollment) => ({
          studentId: enrollment.Student.id,
          name: enrollment.Student.user.name,
          readiness: await buildStudentExamReadiness(enrollment.Student.id),
        }))
      );
      const averageReadiness = average(studentReadiness.map((item) => item.readiness.readinessScore));
      const weakTopicCounts = new Map<string, number>();
      for (const item of studentReadiness) {
        for (const subject of item.readiness.subjects) {
          for (const topic of subject.weakTopics) {
            const key = `${subject.subject}: ${topic}`;
            weakTopicCounts.set(key, (weakTopicCounts.get(key) ?? 0) + 1);
          }
        }
      }

      return {
        classId: klass.id,
        className: klass.name,
        subject: String(klass.subject),
        gradeLevel: klass.gradeLevel,
        studentCount: klass.enrollments.length,
        averageReadiness,
        weakTopics: Array.from(weakTopicCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic]) => topic),
        studentsNeedingSupport: studentReadiness
          .filter((item) => item.readiness.readinessScore != null && item.readiness.readinessScore < 60)
          .map((item) => ({
            studentId: item.studentId,
            name: item.name,
            readinessScore: item.readiness.readinessScore,
          }))
          .slice(0, 10),
      };
    })
  );

  return { generatedAt: new Date().toISOString(), classSummaries };
}

export async function buildMoeOutcomesSummary(): Promise<MoeOutcomesSummary> {
  const [profiles, badgeAwards] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      select: { studentId: true, subject: true, currentScore: true },
    }),
    Promise.resolve()
      .then(() =>
        prisma.studentBadgeAward.findMany({
          select: { badgeKey: true },
        })
      )
      .catch(() => [] as Array<{ badgeKey: string }>),
  ]);
  const bySubject = new Map<string, { studentIds: Set<string>; scores: number[] }>();
  for (const profile of profiles) {
    const subject = String(profile.subject);
    const bucket = bySubject.get(subject) ?? { studentIds: new Set<string>(), scores: [] };
    bucket.studentIds.add(profile.studentId);
    const score = normalizeScore(profile.currentScore);
    if (score != null) bucket.scores.push(score);
    bySubject.set(subject, bucket);
  }

  const badgeCounts = new Map<string, number>();
  for (const award of badgeAwards) {
    badgeCounts.set(award.badgeKey, (badgeCounts.get(award.badgeKey) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    readinessBySubject: Array.from(bySubject.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([subject, bucket]) => {
        const studentCount = bucket.studentIds.size;
        const suppressed = studentCount < MIN_AGGREGATE_COHORT;
        return {
          subject,
          studentCount,
          suppressed,
          averageReadiness: suppressed ? null : average(bucket.scores),
        };
      }),
    badgeAwardsByKey: Array.from(badgeCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([badgeKey, awardCount]) => ({ badgeKey, awardCount })),
  };
}
