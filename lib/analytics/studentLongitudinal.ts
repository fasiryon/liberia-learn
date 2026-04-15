// lib/analytics/studentLongitudinal.ts — Sprint 7
// Student longitudinal progress analytics.
// Internal API only — not a public endpoint.
// Sources: DerivedStudentProgress (has schoolId + growthDelta + masteryState).

import { prisma } from "@/lib/db";

export interface StudentLongitudinalSummary {
  studentId: string;
  schoolId: string | null;
  totalStrands: number;
  masteredStrands: number;
  masteryRatePct: number;
  avgCurrentScore: number | null;
  avgGrowthDelta: number | null;
  atRiskStrands: number;
  latestDerivedAt: string | null;
}

export interface LongitudinalOptions {
  schoolId?: string | null;
  since?: Date;
  limit?: number;
}

const MASTERED_STATES = new Set(["MASTERED", "CONSOLIDATED"]);

/**
 * Returns per-student longitudinal summaries.
 * Sources DerivedStudentProgress which carries schoolId, growthDelta, masteryState.
 */
export async function getStudentLongitudinalSummaries(
  options: LongitudinalOptions = {}
): Promise<StudentLongitudinalSummary[]> {
  const { schoolId, since, limit = 500 } = options;

  const records = await prisma.derivedStudentProgress.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      ...(since ? { derivedAt: { gte: since } } : {}),
    },
    select: {
      studentId: true,
      schoolId: true,
      masteryState: true,
      currentScore: true,
      growthDelta: true,
      derivedAt: true,
    },
    orderBy: { studentId: "asc" },
    take: limit * 30,
  });

  const byStudent = new Map<
    string,
    {
      schoolId: string | null;
      states: string[];
      scores: number[];
      growths: number[];
      latestAt: Date | null;
    }
  >();

  for (const r of records) {
    const entry = byStudent.get(r.studentId) ?? {
      schoolId: r.schoolId,
      states: [],
      scores: [],
      growths: [],
      latestAt: null,
    };
    if (r.masteryState) entry.states.push(r.masteryState);
    if (r.currentScore != null) entry.scores.push(r.currentScore);
    if (r.growthDelta != null) entry.growths.push(r.growthDelta);
    if (!entry.latestAt || (r.derivedAt && r.derivedAt > entry.latestAt)) {
      entry.latestAt = r.derivedAt;
    }
    byStudent.set(r.studentId, entry);
  }

  const summaries: StudentLongitudinalSummary[] = [];
  for (const [studentId, data] of byStudent) {
    const total = data.states.length;
    const mastered = data.states.filter((s) => MASTERED_STATES.has(s)).length;
    const atRisk = data.states.filter((s) => s === "AT_RISK").length;
    const avgScore =
      data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : null;
    const avgGrowth =
      data.growths.length > 0
        ? data.growths.reduce((a, b) => a + b, 0) / data.growths.length
        : null;

    summaries.push({
      studentId,
      schoolId: data.schoolId,
      totalStrands: total,
      masteredStrands: mastered,
      masteryRatePct: total > 0 ? Math.round((mastered / total) * 10000) / 100 : 0,
      avgCurrentScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
      avgGrowthDelta: avgGrowth != null ? Math.round(avgGrowth * 10000) / 10000 : null,
      atRiskStrands: atRisk,
      latestDerivedAt: data.latestAt?.toISOString() ?? null,
    });

    if (summaries.length >= limit) break;
  }

  return summaries;
}

/**
 * Returns aggregate longitudinal stats. Safe for MOE consumption — no per-student rows.
 */
export async function getLongitudinalAggregate(options: { schoolId?: string | null } = {}): Promise<{
  totalStudentsTracked: number;
  avgMasteryRatePct: number | null;
  avgGrowthDelta: number | null;
  atRiskStudentCount: number;
}> {
  const summaries = await getStudentLongitudinalSummaries({
    schoolId: options.schoolId,
    limit: 10000,
  });

  if (summaries.length === 0) {
    return { totalStudentsTracked: 0, avgMasteryRatePct: null, avgGrowthDelta: null, atRiskStudentCount: 0 };
  }

  const avgMastery = summaries.reduce((acc, s) => acc + s.masteryRatePct, 0) / summaries.length;
  const growthSamples = summaries.filter((s) => s.avgGrowthDelta != null);
  const avgGrowth =
    growthSamples.length > 0
      ? growthSamples.reduce((acc, s) => acc + (s.avgGrowthDelta ?? 0), 0) / growthSamples.length
      : null;
  const atRisk = summaries.filter((s) => s.atRiskStrands > 0).length;

  return {
    totalStudentsTracked: summaries.length,
    avgMasteryRatePct: Math.round(avgMastery * 100) / 100,
    avgGrowthDelta: avgGrowth != null ? Math.round(avgGrowth * 10000) / 10000 : null,
    atRiskStudentCount: atRisk,
  };
}
