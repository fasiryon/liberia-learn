import { prisma } from "@/lib/db";

export type StudentPerformanceSummary = {
  studentId: string;
  avgScore: number;
  masteryLevel: "struggling" | "developing" | "proficient" | "advanced";
  improvementTrend: "improving" | "stable" | "declining";
  confusionCount: number;
  pendingInterventions: number;
};

export type ClassPerformanceSummary = {
  teacherId: string;
  schoolId: string;
  studentCount: number;
  avgScore: number;
  studentsStruggling: number;
  activeInterventions: number;
  topConfusionTags: string[];
};

export type SubjectPerformanceSummary = {
  subject: string;
  schoolId: string;
  avgScore: number;
  completionRate: number;
  commonConfusions: string[];
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache<T>(key: string, value: T): T {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function masteryLevelForScore(score: number): StudentPerformanceSummary["masteryLevel"] {
  if (score < 0.4) return "struggling";
  if (score < 0.6) return "developing";
  if (score < 0.8) return "proficient";
  return "advanced";
}

function trendForScores(scores: number[]): StudentPerformanceSummary["improvementTrend"] {
  const lastFive = scores.slice(0, 5);
  const priorFive = scores.slice(5, 10);
  if (lastFive.length === 0 || priorFive.length === 0) {
    return "stable";
  }

  const delta = average(lastFive) - average(priorFive);
  if (delta > 0.05) return "improving";
  if (delta < -0.05) return "declining";
  return "stable";
}

export async function getStudentPerformanceSummary(
  studentId: string,
  schoolId: string
): Promise<StudentPerformanceSummary> {
  const cacheKey = `student:${studentId}`;
  const cached = getFromCache<StudentPerformanceSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const [events, confusionCount, pendingInterventions] = await Promise.all([
    (prisma as any).studentPerformanceEvent.findMany({
      where: { studentId, schoolId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { score: true },
    }),
    (prisma as any).confusionSignal.count({ where: { studentId, schoolId } }),
    (prisma as any).interventionRecommendation.count({
      where: { studentId, schoolId, status: "pending" },
    }),
  ]);

  const scores = events.map((event: { score: number }) => event.score);
  const avgScore = round2(average(scores));
  return setCache(cacheKey, {
    studentId,
    avgScore,
    masteryLevel: masteryLevelForScore(avgScore),
    improvementTrend: trendForScores(scores),
    confusionCount,
    pendingInterventions,
  });
}

export async function getClassPerformanceSummary(
  teacherId: string,
  schoolId: string
): Promise<ClassPerformanceSummary> {
  const cacheKey = `class:${teacherId}`;
  const cached = getFromCache<ClassPerformanceSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const classes = await prisma.class.findMany({
    where: { teacherId, schoolId },
    select: {
      enrollments: { select: { studentId: true } },
    },
  });
  const studentIds = Array.from(
    new Set(classes.flatMap((entry) => entry.enrollments.map((enrollment) => enrollment.studentId)))
  );

  if (studentIds.length === 0) {
    return setCache(cacheKey, {
      teacherId,
      schoolId,
      studentCount: 0,
      avgScore: 0,
      studentsStruggling: 0,
      activeInterventions: 0,
      topConfusionTags: [],
    });
  }

  const [events, interventions, confusionSignals] = await Promise.all([
    (prisma as any).studentPerformanceEvent.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: { studentId: true, score: true },
    }),
    (prisma as any).interventionRecommendation.count({
      where: { schoolId, studentId: { in: studentIds }, status: "pending" },
    }),
    (prisma as any).confusionSignal.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: { conceptTag: true },
    }),
  ]);
  const typedEvents = events as Array<{ studentId: string; score: number }>;
  const typedConfusionSignals = confusionSignals as Array<{ conceptTag: string }>;

  const avgScore = round2(average(typedEvents.map((event) => event.score)));
  const scoreGroups = typedEvents.reduce((acc: Record<string, number[]>, event) => {
    (acc[event.studentId] ??= []).push(event.score);
    return acc;
  }, {});
  const studentsStruggling = studentIds.filter((studentId) => {
    return masteryLevelForScore(average(scoreGroups[studentId] ?? [])) === "struggling";
  }).length;

  const topConfusionTags = Object.entries(
    typedConfusionSignals.reduce((acc: Record<string, number>, signal) => {
      acc[signal.conceptTag] = (acc[signal.conceptTag] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return setCache(cacheKey, {
    teacherId,
    schoolId,
    studentCount: studentIds.length,
    avgScore,
    studentsStruggling,
    activeInterventions: interventions,
    topConfusionTags,
  });
}

export async function getSubjectPerformanceSummary(
  schoolId: string,
  subject: string
): Promise<SubjectPerformanceSummary> {
  const cacheKey = `subject:${schoolId}:${subject}`;
  const cached = getFromCache<SubjectPerformanceSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const [events, confusionSignals] = await Promise.all([
    (prisma as any).studentPerformanceEvent.findMany({
      where: { schoolId, subject },
      select: { score: true, attempts: true },
    }),
    (prisma as any).confusionSignal.findMany({
      where: { schoolId, conceptTag: { startsWith: `${subject}::` } },
      select: { conceptTag: true },
    }),
  ]);
  const typedEvents = events as Array<{ score: number; attempts: number }>;
  const typedConfusionSignals = confusionSignals as Array<{ conceptTag: string }>;

  const avgScore = round2(average(typedEvents.map((event) => event.score)));
  const completionRate =
    typedEvents.length === 0
      ? 0
      : round2(
          typedEvents.filter((event) => event.attempts >= 1).length / typedEvents.length
        );

  const commonConfusions = Object.entries(
    typedConfusionSignals.reduce((acc: Record<string, number>, signal) => {
      acc[signal.conceptTag] = (acc[signal.conceptTag] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  return setCache(cacheKey, {
    subject,
    schoolId,
    avgScore,
    completionRate,
    commonConfusions,
  });
}
