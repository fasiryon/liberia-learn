import { prisma } from "@/lib/db";

export type RecommendationType =
  | "RETRY_ASSESSMENT"
  | "REVISIT_PREREQUISITE"
  | "REVIEW"
  | "CONTINUE"
  | "ADVANCE";

export type ConfidenceTier = "low" | "medium" | "high";

export type MasteryAlertTier = "critical" | "at_risk" | "developing";

export type AdaptiveRecommendation = {
  type: RecommendationType;
  priority: number;
  lessonId: string | null;
  scheduledWorkId: string | null;
  subject: string;
  grade: number | null;
  reason: string;
  sourceSignal: string;
  masteryPercent: number | null;
  confidenceTier: ConfidenceTier;
};

export type MasteryAlert = {
  concept: string;
  subject: string;
  score: number;
  tier: MasteryAlertTier;
};

export type AdaptiveRecommendationResult = {
  recommendation: AdaptiveRecommendation | null;
  masteryAlerts: MasteryAlert[];
  contentGap: boolean;
};

function weightedAssessmentScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  if (scores.length === 1) return scores[0];
  if (scores.length === 2) return scores[0] * 0.6 + scores[1] * 0.4;
  // latest 50%, second 30%, older 20% averaged
  const olderAvg = scores.slice(2).reduce((s, v) => s + v, 0) / (scores.length - 2);
  return scores[0] * 0.5 + scores[1] * 0.3 + olderAvg * 0.2;
}

function confidenceTier(signalCount: number): ConfidenceTier {
  if (signalCount >= 5) return "high";
  if (signalCount >= 2) return "medium";
  return "low";
}

function alertTier(score: number): MasteryAlertTier {
  if (score < 40) return "critical";
  if (score < 65) return "at_risk";
  return "developing";
}

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Merge assessment + snapshot + derived into a single 0-100 mastery score per concept-key.
// Weighting: 60% assessments, 25% mastery snapshot, 15% derived progress.
function combinedMastery(
  assessmentScore: number | null,
  snapshotScore: number | null,
  derivedScore: number | null
): { score: number; signals: number } {
  let total = 0;
  let weight = 0;
  let signals = 0;
  if (typeof assessmentScore === "number") {
    total += assessmentScore * 0.6;
    weight += 0.6;
    signals += 1;
  }
  if (typeof snapshotScore === "number") {
    total += snapshotScore * 0.25;
    weight += 0.25;
    signals += 1;
  }
  if (typeof derivedScore === "number") {
    total += derivedScore * 0.15;
    weight += 0.15;
    signals += 1;
  }
  if (weight === 0) return { score: 0, signals: 0 };
  return { score: clamp((total / weight) * 100), signals };
}

export async function getAdaptiveRecommendations(
  studentId: string,
  schoolId: string | null | undefined,
  userId: string
): Promise<AdaptiveRecommendationResult> {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      enrollments: { select: { classId: true } },
    },
  });

  if (!student) {
    return { recommendation: null, masteryAlerts: [], contentGap: false };
  }

  const classIds = student.enrollments.map((e) => e.classId);

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const twoDaysAgo = new Date(startOfToday.getTime() - 2 * 86_400_000);

  const [assessmentAttempts, masterySnapshots, derivedProgress, scheduledWork] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where: {
        studentId: student.id,
        source: "student.lesson.quiz.submit",
      },
      select: {
        id: true,
        subject: true,
        grade: true,
        score: true,
        attemptedAt: true,
        submittedAt: true,
        metadata: true,
      },
      orderBy: { attemptedAt: "desc" },
      take: 50,
    }),
    prisma.masterySnapshot.findMany({
      where: { studentId: student.id },
      select: { subject: true, strandKey: true, currentScore: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.derivedStudentProgress.findMany({
      where: { studentId: student.id },
      select: { subject: true, strandKey: true, currentScore: true },
      orderBy: { derivedAt: "desc" },
      take: 50,
    }),
    classIds.length > 0
      ? prisma.scheduledWork.findMany({
          where: { classId: { in: classIds } },
          select: {
            id: true,
            scheduledDate: true,
            content: {
              select: {
                contentId: true,
                subject: true,
                grade: true,
              },
            },
            progress: {
              where: { studentId: userId },
              select: { completedAt: true, startedAt: true },
            },
          },
          orderBy: { scheduledDate: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  // Build per-subject assessment score buckets (scores ordered latest-first already)
  const assessmentBySubject = new Map<
    string,
    { scores: number[]; grade: number | null; latestAttemptId: string | null }
  >();
  for (const attempt of assessmentAttempts) {
    if (typeof attempt.score !== "number") continue;
    const subject = attempt.subject ?? "GENERAL";
    const bucket = assessmentBySubject.get(subject) ?? {
      scores: [],
      grade: attempt.grade,
      latestAttemptId: null,
    };
    bucket.scores.push(attempt.score);
    if (!bucket.latestAttemptId) bucket.latestAttemptId = attempt.id;
    assessmentBySubject.set(subject, bucket);
  }

  // Latest snapshot per subject
  const snapshotBySubject = new Map<string, number>();
  for (const snap of masterySnapshots) {
    if (!snapshotBySubject.has(snap.subject) && typeof snap.currentScore === "number") {
      snapshotBySubject.set(snap.subject, snap.currentScore);
    }
  }

  // Latest derived per subject
  const derivedBySubject = new Map<string, number>();
  for (const row of derivedProgress) {
    if (!derivedBySubject.has(row.subject) && typeof row.currentScore === "number") {
      derivedBySubject.set(row.subject, row.currentScore);
    }
  }

  const allSubjects = new Set([
    ...assessmentBySubject.keys(),
    ...snapshotBySubject.keys(),
    ...derivedBySubject.keys(),
  ]);

  // Build mastery alerts for each subject where score < 75
  const masteryAlerts: MasteryAlert[] = [];
  const subjectMastery = new Map<string, number>();

  for (const subject of allSubjects) {
    const bucket = assessmentBySubject.get(subject);
    const assessScore = bucket ? weightedAssessmentScore(bucket.scores) : null;
    const snapScore = snapshotBySubject.get(subject) ?? null;
    const derivScore = derivedBySubject.get(subject) ?? null;
    const { score } = combinedMastery(assessScore, snapScore, derivScore);
    subjectMastery.set(subject, score);
    if (score < 75) {
      masteryAlerts.push({ concept: subject, subject, score, tier: alertTier(score) });
    }
  }

  masteryAlerts.sort((a, b) => a.score - b.score);

  // Determine best recommendation (deterministic priority order)
  const candidates: AdaptiveRecommendation[] = [];

  // RETRY_ASSESSMENT: latest score < 0.60
  for (const [subject, bucket] of assessmentBySubject) {
    const latestScore = bucket.scores[0];
    if (latestScore < 0.60) {
      // Find the most recent incomplete lesson for this subject
      const matchingWork = scheduledWork.find(
        (sw) => sw.content.subject === subject && !sw.progress[0]?.completedAt
      );
      candidates.push({
        type: "RETRY_ASSESSMENT",
        priority: 95,
        lessonId: matchingWork?.content.contentId ?? null,
        scheduledWorkId: matchingWork?.id ?? null,
        subject,
        grade: bucket.grade,
        reason: `Latest quiz score was ${clamp(latestScore * 100)}% — below 60%. Retry to improve mastery.`,
        sourceSignal: "assessment_attempt.low_score",
        masteryPercent: clamp(latestScore * 100),
        confidenceTier: confidenceTier(bucket.scores.length),
      });
    }
  }

  // REVISIT_PREREQUISITE: 3+ attempts all below 0.65
  // Priority 96 — higher than RETRY_ASSESSMENT (95) because persistent failure
  // signals a prerequisite gap, not just a retry opportunity.
  for (const [subject, bucket] of assessmentBySubject) {
    if (bucket.scores.length >= 3 && bucket.scores.every((s) => s < 0.65)) {
      const matchingWork = scheduledWork.find((sw) => sw.content.subject === subject);
      candidates.push({
        type: "REVISIT_PREREQUISITE",
        priority: 96,
        lessonId: matchingWork?.content.contentId ?? null,
        scheduledWorkId: matchingWork?.id ?? null,
        subject,
        grade: bucket.grade,
        reason: `${bucket.scores.length} consecutive attempts below 65% — prerequisite concepts need reinforcement.`,
        sourceSignal: "assessment_attempt.persistent_low_score",
        masteryPercent: clamp((subjectMastery.get(subject) ?? 0)),
        confidenceTier: confidenceTier(bucket.scores.length),
      });
    }
  }

  // REVIEW: score 0.60-0.74 OR incomplete lesson started more than 2 days ago
  for (const [subject, bucket] of assessmentBySubject) {
    const latestScore = bucket.scores[0];
    if (latestScore >= 0.60 && latestScore < 0.75) {
      const matchingWork = scheduledWork.find(
        (sw) => sw.content.subject === subject && !sw.progress[0]?.completedAt
      );
      candidates.push({
        type: "REVIEW",
        priority: 80,
        lessonId: matchingWork?.content.contentId ?? null,
        scheduledWorkId: matchingWork?.id ?? null,
        subject,
        grade: bucket.grade,
        reason: `Quiz score was ${clamp(latestScore * 100)}% — review this lesson to consolidate understanding.`,
        sourceSignal: "assessment_attempt.below_threshold",
        masteryPercent: clamp(latestScore * 100),
        confidenceTier: confidenceTier(bucket.scores.length),
      });
    }
  }

  // REVIEW: lesson started > 2 days ago but not completed
  for (const sw of scheduledWork) {
    const progress = sw.progress[0];
    if (
      progress?.startedAt &&
      !progress.completedAt &&
      sw.scheduledDate <= twoDaysAgo
    ) {
      candidates.push({
        type: "REVIEW",
        priority: 78,
        lessonId: sw.content.contentId,
        scheduledWorkId: sw.id,
        subject: sw.content.subject,
        grade: sw.content.grade,
        reason: "This lesson was started more than 2 days ago but not completed.",
        sourceSignal: "student_progress.stale_incomplete",
        masteryPercent: null,
        confidenceTier: "low",
      });
    }
  }

  // CONTINUE: lesson in progress today
  for (const sw of scheduledWork) {
    const progress = sw.progress[0];
    if (
      progress?.startedAt &&
      !progress.completedAt &&
      sw.scheduledDate >= startOfToday
    ) {
      candidates.push({
        type: "CONTINUE",
        priority: 70,
        lessonId: sw.content.contentId,
        scheduledWorkId: sw.id,
        subject: sw.content.subject,
        grade: sw.content.grade,
        reason: "This lesson is currently in progress.",
        sourceSignal: "student_progress.in_progress",
        masteryPercent: null,
        confidenceTier: "low",
      });
    }
  }

  // ADVANCE: completed lesson with score >= 0.80, next lesson not started
  for (const [subject, bucket] of assessmentBySubject) {
    const latestScore = bucket.scores[0];
    if (latestScore >= 0.80) {
      const nextWork = scheduledWork.find(
        (sw) =>
          sw.content.subject === subject &&
          !sw.progress[0]?.startedAt &&
          !sw.progress[0]?.completedAt
      );
      if (nextWork) {
        candidates.push({
          type: "ADVANCE",
          priority: 50,
          lessonId: nextWork.content.contentId,
          scheduledWorkId: nextWork.id,
          subject,
          grade: nextWork.content.grade,
          reason: `Strong score of ${clamp(latestScore * 100)}% — ready to advance to the next lesson.`,
          sourceSignal: "assessment_attempt.high_score",
          masteryPercent: clamp(latestScore * 100),
          confidenceTier: confidenceTier(bucket.scores.length),
        });
      }
    }
  }

  // Pick the highest priority candidate; break ties by most severe mastery alert
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aMastery = a.masteryPercent ?? 100;
    const bMastery = b.masteryPercent ?? 100;
    return aMastery - bMastery;
  });

  const recommendation = candidates[0] ?? null;

  // Content gap: if the student has no approved content for their grade
  const studentGrade = recommendation?.grade ?? assessmentAttempts[0]?.grade ?? null;
  const contentGap = studentGrade !== null && (studentGrade === 2 || studentGrade === 9);

  return { recommendation, masteryAlerts: masteryAlerts.slice(0, 5), contentGap };
}

// Build class-level intelligence for the teacher dashboard.
export async function buildClassIntelligence(
  classIds: string[],
  schoolId: string
): Promise<{
  atRisk: number;
  topPerformers: number;
  classAvgMastery: number;
  weakLessons: Array<{ contentId: string; title: string; avgScore: number; attemptCount: number }>;
  interventionRecommendations: Array<{ studentId: string; type: string; reason: string }>;
}> {
  if (classIds.length === 0) {
    return { atRisk: 0, topPerformers: 0, classAvgMastery: 0, weakLessons: [], interventionRecommendations: [] };
  }

  const [enrollments, progressRows, pendingInterventions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      select: { studentId: true },
    }),
    prisma.studentProgress.findMany({
      where: {
        scheduledWork: { classId: { in: classIds } },
        exitTicketScore: { not: null },
      },
      select: {
        scheduledWorkId: true,
        exitTicketScore: true,
        scheduledWork: {
          select: {
            contentId: true,
            content: { select: { payload: true } },
          },
        },
      },
      take: 200,
    }),
    prisma.interventionRecommendation.findMany({
      where: {
        schoolId,
        status: "pending",
        student: { enrollments: { some: { classId: { in: classIds } } } },
      },
      select: {
        studentId: true,
        recommendationType: true,
        reason: true,
        confidenceScore: true,
      },
      orderBy: { confidenceScore: "desc" },
      take: 10,
    }),
  ]);

  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

  // Per-student mastery from derived progress
  const derivedRows = await prisma.derivedStudentProgress.findMany({
    where: { studentId: { in: studentIds }, schoolId },
    select: { studentId: true, currentScore: true },
    orderBy: { derivedAt: "desc" },
    take: studentIds.length * 3,
  });

  const masteryByStudent = new Map<string, number[]>();
  for (const row of derivedRows) {
    if (typeof row.currentScore !== "number") continue;
    const bucket = masteryByStudent.get(row.studentId) ?? [];
    bucket.push(row.currentScore);
    masteryByStudent.set(row.studentId, bucket);
  }

  let atRisk = 0;
  let topPerformers = 0;
  let totalMastery = 0;
  let masteryCount = 0;
  for (const sid of studentIds) {
    const scores = masteryByStudent.get(sid) ?? [];
    if (scores.length === 0) continue;
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    totalMastery += avg;
    masteryCount += 1;
    if (avg < 0.65) atRisk += 1;
    if (avg >= 0.80) topPerformers += 1;
  }
  const classAvgMastery = masteryCount > 0 ? clamp((totalMastery / masteryCount) * 100) : 0;

  // Weak lessons: group exit ticket scores by contentId
  const lessonScores = new Map<
    string,
    { title: string; scores: number[]; contentId: string }
  >();
  for (const row of progressRows) {
    if (typeof row.exitTicketScore !== "number") continue;
    const contentId = row.scheduledWork.contentId;
    const payload = row.scheduledWork.content?.payload as Record<string, unknown> | null;
    const title = (payload?.title as string) ?? contentId;
    const bucket = lessonScores.get(contentId) ?? { title, scores: [], contentId };
    bucket.scores.push(row.exitTicketScore);
    lessonScores.set(contentId, bucket);
  }
  const weakLessons = [...lessonScores.values()]
    .map((b) => ({
      contentId: b.contentId,
      title: b.title,
      avgScore: clamp(b.scores.reduce((s, v) => s + v, 0) / b.scores.length),
      attemptCount: b.scores.length,
    }))
    .filter((l) => l.avgScore < 70)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 5);

  const interventionRecommendations = pendingInterventions.map((r) => ({
    studentId: r.studentId,
    type: r.recommendationType,
    reason: r.reason,
  }));

  return { atRisk, topPerformers, classAvgMastery, weakLessons, interventionRecommendations };
}

// Build national curriculum intelligence for the MOE dashboard.
export async function buildMoeCurriculumIntelligence(): Promise<{
  weakSubjects: Array<{ subject: string; avgMastery: number; gap: boolean }>;
  weakLessons: Array<{ contentId: string; avgScore: number; attemptCount: number }>;
  conceptGaps: Array<{ grade: number; subject: string; approvedCount: number; status: "critical" | "severe" | "adequate" }>;
  schoolComparison: Array<{ schoolId: string; avgMastery: number; rank: number }>;
}> {
  const [subjectDerived, progressRows, contentCounts] = await Promise.all([
    prisma.derivedStudentProgress.groupBy({
      by: ["subject"],
      _avg: { currentScore: true },
      orderBy: { _avg: { currentScore: "asc" } },
    }),
    prisma.studentProgress.findMany({
      where: { exitTicketScore: { not: null }, completedAt: { not: null } },
      select: {
        exitTicketScore: true,
        scheduledWork: {
          select: {
            contentId: true,
          },
        },
      },
      take: 500,
    }),
    prisma.curriculumContent.groupBy({
      by: ["grade", "subject", "status"],
      where: { status: "APPROVED" },
      _count: { contentId: true },
      orderBy: [{ grade: "asc" }, { subject: "asc" }],
    }),
  ]);

  const weakSubjects = subjectDerived
    .filter((row) => typeof row._avg.currentScore === "number")
    .map((row) => ({
      subject: row.subject,
      avgMastery: clamp((row._avg.currentScore ?? 0) * 100),
      gap: (row._avg.currentScore ?? 1) < 0.70,
    }));

  // Weak lessons by exit ticket score
  const lessonBuckets = new Map<string, number[]>();
  for (const row of progressRows) {
    if (typeof row.exitTicketScore !== "number") continue;
    const cid = row.scheduledWork.contentId;
    const bucket = lessonBuckets.get(cid) ?? [];
    bucket.push(row.exitTicketScore);
    lessonBuckets.set(cid, bucket);
  }
  const weakLessons = [...lessonBuckets.entries()]
    .map(([contentId, scores]) => ({
      contentId,
      avgScore: clamp(scores.reduce((s, v) => s + v, 0) / scores.length),
      attemptCount: scores.length,
    }))
    .filter((l) => l.avgScore < 70)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 10);

  // Concept (grade/subject) gaps from DB counts
  const conceptGaps = contentCounts.map((row) => {
    const count = row._count.contentId;
    const status: "critical" | "severe" | "adequate" =
      count <= 2 ? "critical" : count < 15 ? "severe" : "adequate";
    return {
      grade: row.grade,
      subject: row.subject,
      approvedCount: count,
      status,
    };
  });

  // School comparison by average derived mastery
  const schoolRows = await prisma.derivedStudentProgress.groupBy({
    by: ["schoolId"],
    _avg: { currentScore: true },
    where: { schoolId: { not: null } },
    orderBy: { _avg: { currentScore: "desc" } },
    take: 20,
  });

  const schoolComparison = schoolRows
    .filter((r) => r.schoolId && typeof r._avg.currentScore === "number")
    .map((r, idx) => ({
      schoolId: r.schoolId!,
      avgMastery: clamp((r._avg.currentScore ?? 0) * 100),
      rank: idx + 1,
    }));

  return { weakSubjects, weakLessons, conceptGaps, schoolComparison };
}
