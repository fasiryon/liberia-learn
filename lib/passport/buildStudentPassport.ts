/**
 * lib/passport/buildStudentPassport.ts — Sprint 6
 *
 * Computes a student's longitudinal learning passport from existing
 * Sprint 2–3 data structures (StudentMasteryProfile, DerivedStudentProgress,
 * InterventionChain). No new schema model — pure computed view.
 *
 * Privacy: student sees their own data only. Guardian sees their linked student's
 * data. No MOE access to individual student passports.
 */

import { prisma } from "@/lib/db";

export type SubjectPassportEntry = {
  subject: string;
  strandCount: number;
  masteredStrandCount: number;
  avgCurrentScore: number | null;
  avgGrowthDelta: number | null;
  avgSustainabilityIndex: number | null;
  dominantMasteryState: string | null;
  openInterventionChainCount: number;
  lastAssessedAt: string | null;
};

export type StudentPassport = {
  studentId: string;
  generatedAt: string;
  totalStrands: number;
  masteredStrands: number;
  overallMasteryPct: number | null;
  avgCurrentScore: number | null;
  subjects: SubjectPassportEntry[];
  interventionSummary: {
    total: number;
    open: number;
    inProgress: number;
    closed: number;
  };
  latestActivityAt: string | null;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

function dominantState(states: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const s of states) {
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [state, count] of counts) {
    if (count > bestCount) {
      best = state;
      bestCount = count;
    }
  }
  return best;
}

const MASTERED_STATES = new Set(["MASTERED", "CONSOLIDATED"]);

export async function buildStudentPassport(studentId: string): Promise<StudentPassport> {
  const [masteryProfiles, derivedProgress, interventionChains] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      where: { studentId },
      select: {
        subject: true,
        strandKey: true,
        currentScore: true,
        masteryState: true,
        sustainabilityIndex: true,
        lastAssessedAt: true,
      },
      orderBy: { lastAssessedAt: "desc" },
    }),
    prisma.derivedStudentProgress.findMany({
      where: { studentId },
      select: {
        subject: true,
        strandKey: true,
        growthDelta: true,
        openInterventionChainCount: true,
        derivedAt: true,
      },
      orderBy: { derivedAt: "desc" },
    }),
    prisma.interventionChain.findMany({
      where: { studentId },
      select: { status: true, openedAt: true },
    }),
  ]);

  // Index derived progress by subject+strand for lookups
  const derivedByKey = new Map<string, (typeof derivedProgress)[0]>();
  for (const dp of derivedProgress) {
    const key = `${dp.subject}::${dp.strandKey ?? ""}`;
    if (!derivedByKey.has(key)) derivedByKey.set(key, dp); // first = most recent
  }

  // Group mastery profiles by subject
  const bySubject = new Map<string, typeof masteryProfiles>();
  for (const mp of masteryProfiles) {
    const list = bySubject.get(mp.subject) ?? [];
    list.push(mp);
    bySubject.set(mp.subject, list);
  }

  const subjects: SubjectPassportEntry[] = Array.from(bySubject.entries()).map(
    ([subject, profiles]) => {
      const currentScores = profiles.map((p) => p.currentScore);
      const growthDeltas: number[] = [];
      let openInterventions = 0;
      let latestAssessedAt: Date | null = null;

      for (const p of profiles) {
        const key = `${p.subject}::${p.strandKey}`;
        const dp = derivedByKey.get(key);
        if (dp?.growthDelta != null) growthDeltas.push(dp.growthDelta);
        if (dp?.openInterventionChainCount) openInterventions += dp.openInterventionChainCount;
        if (p.lastAssessedAt && (!latestAssessedAt || p.lastAssessedAt > latestAssessedAt)) {
          latestAssessedAt = p.lastAssessedAt;
        }
      }

      const masteredCount = profiles.filter((p) =>
        MASTERED_STATES.has(String(p.masteryState))
      ).length;

      return {
        subject,
        strandCount: profiles.length,
        masteredStrandCount: masteredCount,
        avgCurrentScore: avg(currentScores),
        avgGrowthDelta: avg(growthDeltas),
        avgSustainabilityIndex: avg(profiles.map((p) => p.sustainabilityIndex)),
        dominantMasteryState: dominantState(profiles.map((p) => String(p.masteryState))),
        openInterventionChainCount: openInterventions,
        lastAssessedAt: latestAssessedAt ? latestAssessedAt.toISOString() : null,
      };
    }
  );

  const totalStrands = masteryProfiles.length;
  const masteredStrands = masteryProfiles.filter((p) =>
    MASTERED_STATES.has(String(p.masteryState))
  ).length;
  const allScores = masteryProfiles.map((p) => p.currentScore);

  const interventionCounts = { total: 0, open: 0, inProgress: 0, closed: 0 };
  let latestActivity: Date | null = null;
  for (const chain of interventionChains) {
    interventionCounts.total++;
    const s = chain.status ?? "";
    if (s === "open") interventionCounts.open++;
    else if (s === "in_progress" || s === "intervention") interventionCounts.inProgress++;
    else if (s === "closed" || s === "resolved") interventionCounts.closed++;
    if (!latestActivity || chain.openedAt > latestActivity) latestActivity = chain.openedAt;
  }
  // Also check mastery profile timestamps for last activity
  for (const mp of masteryProfiles) {
    if (mp.lastAssessedAt && (!latestActivity || mp.lastAssessedAt > latestActivity)) {
      latestActivity = mp.lastAssessedAt;
    }
  }

  return {
    studentId,
    generatedAt: new Date().toISOString(),
    totalStrands,
    masteredStrands,
    overallMasteryPct:
      totalStrands > 0 ? Math.round((masteredStrands / totalStrands) * 10000) / 100 : null,
    avgCurrentScore: avg(allScores),
    subjects,
    interventionSummary: interventionCounts,
    latestActivityAt: latestActivity ? latestActivity.toISOString() : null,
  };
}
