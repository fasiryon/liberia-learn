import { prisma } from "@/lib/db";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

type SessionUserLike = {
  id: string;
  schoolId?: string | null;
};

type JsonRecord = Record<string, unknown>;

export type ConfidenceTier = "low" | "medium" | "high";

export type ConceptMastery = {
  conceptKey: string;
  label: string;
  subject: string;
  masteryPercent: number;
  confidenceTier: ConfidenceTier;
  evidenceCount: number;
  lastAssessedAt: string | null;
};

export type SubjectMastery = {
  subject: string;
  label: string;
  masteryPercent: number;
  confidenceTier: ConfidenceTier;
  evidenceCount: number;
  completedLessons: number;
  totalLessons: number;
  latestQuizScorePercent: number | null;
  weakConcepts: ConceptMastery[];
};

export type WeaknessSignal = {
  type:
    | "repeated_low_performance"
    | "incomplete_learning_loop"
    | "concept_weakness"
    | "overdue_review";
  subject: string;
  label: string;
  severity: "low" | "medium" | "high";
  reason: string;
  evidenceCount: number;
  href: string | null;
};

export type RecommendedNextAction = {
  type:
    | "continue_current_lesson"
    | "review_weak_lesson"
    | "retry_quiz"
    | "recommended_next_lesson";
  label: string;
  reason: string;
  href: string;
  priority: number;
};

export type StudentLearningIntelligence = {
  generatedAt: string;
  masteryBySubject: SubjectMastery[];
  weaknesses: WeaknessSignal[];
  recommendedNextActions: RecommendedNextAction[];
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function subjectLabel(subject: string) {
  return subject.replace(/_/g, " ");
}

function confidenceTier(evidenceCount: number): ConfidenceTier {
  if (evidenceCount >= 4) return "high";
  if (evidenceCount >= 2) return "medium";
  return "low";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getAttemptRefs(metadata: unknown) {
  const record = asRecord(metadata);
  return {
    scheduledWorkId: getString(record.scheduledWorkId),
    contentId: getString(record.contentId),
  };
}

function conceptLabel(value: string) {
  return value
    .split(/::|[._-]/g)
    .filter(Boolean)
    .join(" ");
}

function extractConcepts(attempt: { evaluation: unknown; metadata: unknown; subject: string | null }) {
  const concepts = new Set<string>();
  const metadata = asRecord(attempt.metadata);
  const evaluation = asRecord(attempt.evaluation);
  const gapAnalysis = asRecord(evaluation.gapAnalysis);

  for (const key of ["concept", "conceptKey", "strandKey"]) {
    const value = getString(metadata[key]);
    if (value) concepts.add(value);
  }

  const metadataConcepts = metadata.concepts;
  if (Array.isArray(metadataConcepts)) {
    for (const value of metadataConcepts) {
      const concept = getString(value);
      if (concept) concepts.add(concept);
    }
  }

  const missedConcepts = gapAnalysis.missedConcepts;
  if (Array.isArray(missedConcepts)) {
    for (const item of missedConcepts) {
      const record = asRecord(item);
      const concept = getString(record.concept) ?? getString(record.label);
      if (concept) concepts.add(concept);
    }
  }

  if (concepts.size === 0 && attempt.subject) {
    concepts.add(attempt.subject);
  }

  return [...concepts];
}

function daysSince(value: Date) {
  return Math.floor((Date.now() - value.getTime()) / 86_400_000);
}

function actionHrefForAttempt(metadata: unknown) {
  const refs = getAttemptRefs(metadata);
  if (refs.scheduledWorkId) return `/student/lessons/${refs.scheduledWorkId}`;
  if (refs.contentId) return `/student/lesson/${refs.contentId}`;
  return "/student/today";
}

export async function buildStudentLearningIntelligence(
  user: SessionUserLike
): Promise<StudentLearningIntelligence> {
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      enrollments: {
        select: {
          classId: true,
        },
      },
    },
  });

  if (!student) {
    return {
      generatedAt: new Date().toISOString(),
      masteryBySubject: [],
      weaknesses: [],
      recommendedNextActions: [],
    };
  }

  const classIds = student.enrollments.map((enrollment) => enrollment.classId);

  const [
    scheduledLessons,
    lessonProgress,
    quizAttempts,
    derivedProgress,
    misconceptionTags,
    interventionRecommendations,
  ] = await Promise.all([
    classIds.length > 0
      ? prisma.scheduledWork.findMany({
          where: {
            classId: { in: classIds },
            class: user.schoolId ? { schoolId: user.schoolId } : undefined,
          },
          select: {
            id: true,
            scheduledDate: true,
            periodNumber: true,
            contentId: true,
            content: {
              select: {
                contentId: true,
                subject: true,
                payload: true,
              },
            },
          },
          orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }],
        })
      : Promise.resolve([]),
    prisma.studentProgress.findMany({
      where: {
        studentId: user.id,
        scheduledWork: user.schoolId
          ? { class: { schoolId: user.schoolId } }
          : undefined,
      },
      select: {
        scheduledWorkId: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assessmentAttempt.findMany({
      where: {
        studentId: student.id,
        source: "student.lesson.quiz.submit",
      },
      select: {
        id: true,
        subject: true,
        score: true,
        attemptedAt: true,
        submittedAt: true,
        metadata: true,
        evaluation: true,
      },
      orderBy: { attemptedAt: "desc" },
      take: 100,
    }),
    prisma.derivedStudentProgress.findMany({
      where: {
        studentId: student.id,
      },
      select: {
        subject: true,
        strandKey: true,
        currentScore: true,
        masteryState: true,
        derivedAt: true,
      },
      orderBy: { derivedAt: "desc" },
      take: 100,
    }),
    (prisma as typeof prisma & {
      misconceptionTag?: {
        findMany?: (args: unknown) => Promise<
          Array<{
            id: string;
            confidence: number | null;
            evidence: unknown;
            createdAt: Date;
          }>
        >;
      };
    }).misconceptionTag?.findMany?.({
      where: {
        studentId: student.id,
        schoolId: user.schoolId ?? undefined,
        status: "active",
      },
      select: {
        id: true,
        confidence: true,
        evidence: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }) ?? Promise.resolve([]),
    prisma.interventionRecommendation.findMany({
      where: {
        studentId: student.id,
        schoolId: user.schoolId ?? undefined,
        status: "pending",
      },
      select: {
        lessonId: true,
        recommendationType: true,
        reason: true,
        confidenceScore: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const progressByWorkId = new Map(
    lessonProgress.map((progress) => [progress.scheduledWorkId, progress] as const)
  );
  const completedWorkIds = new Set(
    lessonProgress
      .filter((progress) => progress.completedAt)
      .map((progress) => progress.scheduledWorkId)
  );

  const lessonMetaById = new Map<
    string,
    { title: string; subject: string; scheduledDate: Date }
  >();
  const subjectTotals = new Map<string, { total: number; completed: number }>();
  for (const lesson of scheduledLessons) {
    const payload = asRecord(lesson.content.payload);
    const title = resolveLessonTitle({
      payload,
      subject: lesson.content.subject,
      fallbackTitle: lesson.content.contentId,
    });
    lessonMetaById.set(lesson.id, {
      title,
      subject: lesson.content.subject,
      scheduledDate: lesson.scheduledDate,
    });
    lessonMetaById.set(lesson.content.contentId, {
      title,
      subject: lesson.content.subject,
      scheduledDate: lesson.scheduledDate,
    });

    const total = subjectTotals.get(lesson.content.subject) ?? { total: 0, completed: 0 };
    total.total += 1;
    if (completedWorkIds.has(lesson.id)) total.completed += 1;
    subjectTotals.set(lesson.content.subject, total);
  }

  const attemptsBySubject = new Map<string, typeof quizAttempts>();
  for (const attempt of quizAttempts) {
    const subject = attempt.subject ?? "GENERAL";
    const current = attemptsBySubject.get(subject) ?? [];
    current.push(attempt);
    attemptsBySubject.set(subject, current);
  }

  const latestDerivedBySubject = new Map<string, (typeof derivedProgress)[number]>();
  const latestDerivedByConcept = new Map<string, (typeof derivedProgress)[number]>();
  for (const row of derivedProgress) {
    if (!latestDerivedBySubject.has(row.subject)) {
      latestDerivedBySubject.set(row.subject, row);
    }
    if (row.strandKey) {
      const key = `${row.subject}::${row.strandKey}`;
      if (!latestDerivedByConcept.has(key)) {
        latestDerivedByConcept.set(key, row);
      }
    }
  }

  const conceptBuckets = new Map<
    string,
    { subject: string; scores: number[]; lastAssessedAt: Date | null }
  >();
  for (const attempt of quizAttempts) {
    if (typeof attempt.score !== "number") continue;
    const subject = attempt.subject ?? "GENERAL";
    for (const concept of extractConcepts(attempt)) {
      const key = `${subject}::${concept}`;
      const bucket = conceptBuckets.get(key) ?? {
        subject,
        scores: [],
        lastAssessedAt: null,
      };
      bucket.scores.push(attempt.score);
      const occurredAt = attempt.submittedAt ?? attempt.attemptedAt;
      if (!bucket.lastAssessedAt || occurredAt > bucket.lastAssessedAt) {
        bucket.lastAssessedAt = occurredAt;
      }
      conceptBuckets.set(key, bucket);
    }
  }
  for (const row of derivedProgress) {
    if (!row.strandKey || typeof row.currentScore !== "number") continue;
    const key = `${row.subject}::${row.strandKey}`;
    const bucket = conceptBuckets.get(key) ?? {
      subject: row.subject,
      scores: [],
      lastAssessedAt: null,
    };
    bucket.scores.push(row.currentScore);
    if (!bucket.lastAssessedAt || row.derivedAt > bucket.lastAssessedAt) {
      bucket.lastAssessedAt = row.derivedAt;
    }
    conceptBuckets.set(key, bucket);
  }

  const conceptsBySubject = new Map<string, ConceptMastery[]>();
  for (const [key, bucket] of conceptBuckets) {
    const [, conceptKey] = key.split("::");
    const masteryPercent = clampPercent((average(bucket.scores) ?? 0) * 100);
    const item: ConceptMastery = {
      conceptKey,
      label: conceptLabel(conceptKey),
      subject: bucket.subject,
      masteryPercent,
      confidenceTier: confidenceTier(bucket.scores.length),
      evidenceCount: bucket.scores.length,
      lastAssessedAt: bucket.lastAssessedAt?.toISOString() ?? null,
    };
    const current = conceptsBySubject.get(bucket.subject) ?? [];
    current.push(item);
    conceptsBySubject.set(bucket.subject, current);
  }

  const subjectKeys = Array.from(
    new Set([
      ...subjectTotals.keys(),
      ...attemptsBySubject.keys(),
      ...latestDerivedBySubject.keys(),
      ...conceptsBySubject.keys(),
    ])
  ).sort();

  const masteryBySubject: SubjectMastery[] = subjectKeys.map((subject) => {
    const totals = subjectTotals.get(subject) ?? { total: 0, completed: 0 };
    const attempts = attemptsBySubject.get(subject) ?? [];
    const scores = attempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => typeof score === "number");
    const latestDerived = latestDerivedBySubject.get(subject);
    const derivedScore =
      typeof latestDerived?.currentScore === "number" ? latestDerived.currentScore : null;
    const quizAverage = average(scores);
    const completionScore = totals.total > 0 ? totals.completed / totals.total : null;
    const scoreParts = [derivedScore, quizAverage, completionScore].filter(
      (score): score is number => typeof score === "number"
    );
    const weakConcepts = (conceptsBySubject.get(subject) ?? [])
      .filter((concept) => concept.masteryPercent < 70)
      .sort((left, right) => left.masteryPercent - right.masteryPercent)
      .slice(0, 3);

    return {
      subject,
      label: subjectLabel(subject),
      masteryPercent: clampPercent((average(scoreParts) ?? 0) * 100),
      confidenceTier: confidenceTier(scores.length + (derivedScore != null ? 1 : 0)),
      evidenceCount: scores.length + (derivedScore != null ? 1 : 0),
      completedLessons: totals.completed,
      totalLessons: totals.total,
      latestQuizScorePercent:
        typeof attempts[0]?.score === "number" ? clampPercent(attempts[0].score * 100) : null,
      weakConcepts,
    };
  });

  const weaknesses: WeaknessSignal[] = [];
  for (const [subject, attempts] of attemptsBySubject) {
    const lowAttempts = attempts.filter(
      (attempt) => typeof attempt.score === "number" && attempt.score < 0.65
    );
    if (lowAttempts.length >= 2) {
      const href = actionHrefForAttempt(lowAttempts[0].metadata);
      weaknesses.push({
        type: "repeated_low_performance",
        subject,
        label: `${subjectLabel(subject)} quiz performance`,
        severity: lowAttempts.length >= 3 ? "high" : "medium",
        reason: `${lowAttempts.length} recent quiz attempts are below 65%.`,
        evidenceCount: lowAttempts.length,
        href,
      });
    }
  }

  for (const lesson of scheduledLessons) {
    const progress = progressByWorkId.get(lesson.id);
    if (progress?.startedAt && !progress.completedAt) {
      const meta = lessonMetaById.get(lesson.id);
      weaknesses.push({
        type: "incomplete_learning_loop",
        subject: meta?.subject ?? lesson.content.subject,
        label: meta?.title ?? "Incomplete lesson",
        severity: "medium",
        reason: "Lesson was started but has not been completed.",
        evidenceCount: 1,
        href: `/student/lessons/${lesson.id}`,
      });
    }
  }

  for (const subject of masteryBySubject) {
    for (const concept of subject.weakConcepts) {
      weaknesses.push({
        type: "concept_weakness",
        subject: subject.subject,
        label: concept.label,
        severity: concept.masteryPercent < 50 ? "high" : "medium",
        reason: `Concept mastery is ${concept.masteryPercent}% across ${concept.evidenceCount} signal(s).`,
        evidenceCount: concept.evidenceCount,
        href: null,
      });
    }
  }

  for (const tag of misconceptionTags) {
    const evidence = asRecord(tag.evidence);
    const contentId = getString(evidence.contentId);
    const missedConcepts = Array.isArray(evidence.missedConcepts)
      ? evidence.missedConcepts.map(getString).filter((value): value is string => Boolean(value))
      : [];
    weaknesses.push({
      type: "concept_weakness",
      subject: "GENERAL",
      label: missedConcepts[0] ?? "Misconception follow-up",
      severity: (tag.confidence ?? 0) >= 0.6 ? "high" : "medium",
      reason: "Active misconception tag from a lesson quiz needs review.",
      evidenceCount: 1,
      href: contentId ? `/student/lesson/${contentId}` : null,
    });
  }

  const latestAttempt = quizAttempts.find((attempt) => typeof attempt.score === "number");
  if (latestAttempt?.attemptedAt && typeof latestAttempt.score === "number") {
    if (latestAttempt.score < 0.75 && daysSince(latestAttempt.attemptedAt) >= 14) {
      weaknesses.push({
        type: "overdue_review",
        subject: latestAttempt.subject ?? "GENERAL",
        label: `${subjectLabel(latestAttempt.subject ?? "GENERAL")} review`,
        severity: "medium",
        reason: "The last quiz signal is older than two weeks and below 75%.",
        evidenceCount: 1,
        href: actionHrefForAttempt(latestAttempt.metadata),
      });
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const incompleteToday = scheduledLessons.find((lesson) => {
    const scheduledKey = lesson.scheduledDate.toISOString().slice(0, 10);
    return scheduledKey === todayKey && !completedWorkIds.has(lesson.id);
  });
  const firstIncomplete = scheduledLessons.find((lesson) => !completedWorkIds.has(lesson.id));
  const lowestRecentAttempt = quizAttempts
    .filter((attempt) => typeof attempt.score === "number" && attempt.score < 0.7)
    .sort((left, right) => (left.score ?? 1) - (right.score ?? 1))[0];
  const strongestWeakness = weaknesses[0];

  const actions: RecommendedNextAction[] = [];
  if (incompleteToday) {
    const meta = lessonMetaById.get(incompleteToday.id);
    actions.push({
      type: "continue_current_lesson",
      label: `Continue ${meta?.title ?? "today's lesson"}`,
      reason: "This is the next incomplete item in today's scheduled work.",
      href: `/student/lessons/${incompleteToday.id}`,
      priority: 100,
    });
  }
  if (lowestRecentAttempt) {
    const href = `${actionHrefForAttempt(lowestRecentAttempt.metadata)}#lesson-quiz`;
    actions.push({
      type: "retry_quiz",
      label: "Retry quiz",
      reason: `Recent score was ${clampPercent((lowestRecentAttempt.score ?? 0) * 100)}%.`,
      href,
      priority: 90,
    });
  }
  if (strongestWeakness?.href) {
    actions.push({
      type: "review_weak_lesson",
      label: `Review ${strongestWeakness.label}`,
      reason: strongestWeakness.reason,
      href: strongestWeakness.href,
      priority: 80,
    });
  }
  if (firstIncomplete && firstIncomplete.id !== incompleteToday?.id) {
    const meta = lessonMetaById.get(firstIncomplete.id);
    actions.push({
      type: "recommended_next_lesson",
      label: `Start ${meta?.title ?? "next lesson"}`,
      reason: "This is the next assigned lesson that is not complete.",
      href: `/student/lessons/${firstIncomplete.id}`,
      priority: 70,
    });
  }
  for (const recommendation of interventionRecommendations) {
    if (!recommendation.lessonId) continue;
    actions.push({
      type: "review_weak_lesson",
      label: recommendation.recommendationType.replace(/_/g, " "),
      reason: recommendation.reason,
      href: `/student/lessons/${recommendation.lessonId}`,
      priority: Math.round(60 + recommendation.confidenceScore * 10),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    masteryBySubject,
    weaknesses: weaknesses
      .sort((left, right) => {
        const severity = { high: 3, medium: 2, low: 1 };
        return severity[right.severity] - severity[left.severity];
      })
      .slice(0, 8),
    recommendedNextActions: actions
      .sort((left, right) => right.priority - left.priority)
      .filter(
        (action, index, list) =>
          list.findIndex((item) => item.href === action.href && item.type === action.type) === index
      )
      .slice(0, 4),
  };
}
