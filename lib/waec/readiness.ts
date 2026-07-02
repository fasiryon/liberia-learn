/**
 * lib/waec/readiness.ts — PHASE 5A Foundation (D4)
 *
 * Computes per-student WAEC readiness on top of the existing mastery engine
 * (StudentMasteryProfile). Readiness is recomputed on read — no new storage — so it is
 * always consistent with current mastery data.
 *
 * Definition (per WAEC subject):
 *   topicScore   = average of the current mastery scores of the topic's strands that the
 *                  student has actually been assessed on (unassessed strands are ignored).
 *   readiness    = examWeight-weighted average of covered topics' scores, normalised over
 *                  the covered weight, expressed 0–100.
 *   coverage     = fraction of the subject's total exam weight that is assessed.
 *   trend        = direction of change from baseline to current across covered strands.
 *
 * Honesty guarantees:
 *   - Returns readiness = null when the student has no assessed strand in the subject
 *     ("take a placement assessment"), never a fabricated score.
 *   - Returns available = false for WAEC subjects with no mastery strands (e.g. Geography).
 */
import { prisma as defaultPrisma } from "@/lib/db";
import {
  getWaecSubject,
  getWaecSubjects,
  subjectStrandRefs,
  type WaecSubjectId,
} from "@/lib/waec/syllabus";

export type ReadinessTrend = "improving" | "steady" | "declining" | "unknown";

export type TopicReadiness = {
  topicId: string;
  name: string;
  examWeight: number;
  /** 0–100, or null when no strand for this topic is assessed. */
  score: number | null;
  assessedStrands: number;
};

export type SubjectReadiness = {
  subjectId: WaecSubjectId;
  name: string;
  /** false when the subject has no mastery strands (readiness cannot be computed). */
  available: boolean;
  /** 0–100, or null when unassessed / unavailable. */
  readiness: number | null;
  /** 0–1 fraction of the exam (by weight) the student has been assessed on. */
  coverage: number;
  trend: ReadinessTrend;
  /** Weakest area to work on next (topic id/name), or null when nothing is assessed. */
  nextFocusTopicId: string | null;
  nextFocusName: string | null;
  topics: TopicReadiness[];
};

/** Per-strand scores for a student in one mastery subject bucket. */
export type StrandScore = { current: number; baseline: number };

const TREND_DEADBAND = 0.03;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pure readiness computation. `strandScores` maps strandKey → {current, baseline} for the
 * strands the student has been assessed on (0–1 scale). Strands not present are treated as
 * unassessed. Deterministic and side-effect free — the unit-test surface.
 */
export function computeSubjectReadiness(
  subjectId: WaecSubjectId,
  strandScores: Record<string, StrandScore>
): SubjectReadiness {
  const subject = getWaecSubject(subjectId);
  if (!subject) {
    return {
      subjectId, name: subjectId, available: false, readiness: null,
      coverage: 0, trend: "unknown", nextFocusTopicId: null, nextFocusName: null, topics: [],
    };
  }

  const available = subject.masterySubject !== null;
  const topics: TopicReadiness[] = [];
  let weightedSum = 0;
  let coveredWeight = 0;
  let totalWeight = 0;
  let growthSum = 0;
  let growthCount = 0;

  for (const topic of subject.topics) {
    totalWeight += topic.examWeight;
    const assessed = topic.strands.filter((s) => strandScores[s.strandKey] !== undefined);
    let score: number | null = null;
    if (assessed.length > 0) {
      const avg = assessed.reduce((acc, s) => acc + strandScores[s.strandKey].current, 0) / assessed.length;
      score = round1(avg * 100);
      weightedSum += avg * topic.examWeight;
      coveredWeight += topic.examWeight;
      for (const s of assessed) {
        growthSum += strandScores[s.strandKey].current - strandScores[s.strandKey].baseline;
        growthCount++;
      }
    }
    topics.push({ topicId: topic.id, name: topic.name, examWeight: topic.examWeight, score, assessedStrands: assessed.length });
  }

  const readiness = coveredWeight > 0 ? round1((weightedSum / coveredWeight) * 100) : null;
  const coverage = totalWeight > 0 ? coveredWeight / totalWeight : 0;

  let trend: ReadinessTrend = "unknown";
  if (available && growthCount > 0 && readiness !== null) {
    const avgGrowth = growthSum / growthCount;
    trend = avgGrowth > TREND_DEADBAND ? "improving" : avgGrowth < -TREND_DEADBAND ? "declining" : "steady";
  }

  // Next focus: the weakest *covered* topic; if none covered, the highest-weight topic.
  let nextFocusTopicId: string | null = null;
  let nextFocusName: string | null = null;
  const covered = topics.filter((t) => t.score !== null);
  if (covered.length > 0) {
    const weakest = covered.reduce((a, b) => (b.score! < a.score! ? b : a));
    nextFocusTopicId = weakest.topicId;
    nextFocusName = weakest.name;
  } else if (available) {
    const top = [...subject.topics].sort((a, b) => b.examWeight - a.examWeight)[0];
    if (top) {
      nextFocusTopicId = top.id;
      nextFocusName = top.name;
    }
  }

  return {
    subjectId, name: subject.name, available,
    readiness: available ? readiness : null,
    coverage, trend, nextFocusTopicId, nextFocusName, topics,
  };
}

type PrismaLike = typeof defaultPrisma;

/** Load assessed strand scores for a student in one WAEC subject's mastery bucket. */
async function loadStrandScores(
  studentId: string,
  subjectId: WaecSubjectId,
  client: PrismaLike
): Promise<Record<string, StrandScore>> {
  const subject = getWaecSubject(subjectId);
  if (!subject || subject.masterySubject === null) return {};
  const strandKeys = subjectStrandRefs(subjectId).map((r) => r.strandKey);
  if (strandKeys.length === 0) return {};

  const profiles = await client.studentMasteryProfile.findMany({
    where: {
      studentId,
      subject: subject.masterySubject,
      strandKey: { in: strandKeys },
      lastAssessedAt: { not: null },
    },
    select: { strandKey: true, currentScore: true, baselineScore: true },
  });

  const out: Record<string, StrandScore> = {};
  for (const p of profiles) {
    out[p.strandKey] = { current: p.currentScore, baseline: p.baselineScore };
  }
  return out;
}

/** Readiness for one student × WAEC subject (recomputed on read from mastery data). */
export async function getStudentWaecReadiness(
  studentId: string,
  subjectId: WaecSubjectId,
  client: PrismaLike = defaultPrisma
): Promise<SubjectReadiness> {
  const scores = await loadStrandScores(studentId, subjectId, client);
  return computeSubjectReadiness(subjectId, scores);
}

/** Readiness across all WAEC subjects for a student. */
export async function getStudentWaecReadinessAll(
  studentId: string,
  client: PrismaLike = defaultPrisma
): Promise<SubjectReadiness[]> {
  return Promise.all(getWaecSubjects().map((s) => getStudentWaecReadiness(studentId, s.id, client)));
}
