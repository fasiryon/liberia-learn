/**
 * lib/reporting/dashboard/dashboardAggregator.ts — Block 9: Dashboard Aggregation
 *
 * Computes leadership-ready dashboard metrics for school and national scopes.
 * No PII is returned — all outputs are aggregated counts and rates.
 *
 * Tier distribution source of truth:
 *   Derived from StudentMasteryProfile.proficiencyState and .masteryState,
 *   which are computed by lib/mastery/masteryService.ts using the thresholds
 *   in lib/mastery/compute.ts. Tier labels (bronze/silver/gold/platinum) map
 *   directly to these pre-computed states — no independent threshold values.
 *
 * Tenant isolation:
 *   - computeSchoolDashboard(schoolId) filters all queries to that school.
 *   - computeNationalDashboard() queries without school filter (platform only).
 *   - Callers are responsible for enforcing auth before calling these functions.
 *
 * Empty-dataset safety:
 *   - All averages and rates return 0 when the denominator is 0.
 *   - Empty student set short-circuits to emptyMetrics() immediately.
 *
 * Known limitations (Block 9):
 *   - Evidence submission rate uses StudentMasteryProfile presence as proxy.
 *     Block 10 will use AttemptLog when that table is live in production.
 *   - Active students uses StudentMasteryProfile.lastAssessedAt (30d window).
 */

import { prisma } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TierDistribution = {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
};

export type DashboardMetrics = {
  avgMasteryScore: number;
  avgBaselineGrowth: number;
  tierDistribution: TierDistribution;
  totalStudents: number;
  activeStudents: number;
  monthlyReportCompletionRate: number;
  evidenceSubmissionRate: number;
  trainingAdoptionRate: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function safeRate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/**
 * Maps StudentMasteryProfile computed states to bronze/silver/gold/platinum tiers.
 *
 * Source of truth: proficiencyState and masteryState as computed by
 * lib/mastery/masteryService.ts using thresholds from lib/mastery/compute.ts.
 *
 * Tier definitions:
 *   Platinum — masteryState = MASTERED (sustained ≥85% across spaced assessments)
 *   Gold     — proficiencyState = PROFICIENT, masteryState ≠ MASTERED (≥75% accuracy)
 *   Silver   — proficiencyState = APPROACHING (≥60% accuracy)
 *   Bronze   — proficiencyState = BELOW_PROFICIENT or NOT_ASSESSED
 */
export function classifyProfileTier(profile: {
  proficiencyState: string;
  masteryState: string;
}): keyof TierDistribution {
  if (profile.masteryState === "MASTERED") return "platinum";
  if (profile.proficiencyState === "PROFICIENT") return "gold";
  if (profile.proficiencyState === "APPROACHING") return "silver";
  return "bronze";
}

function computeTierDistribution(
  profiles: Array<{ proficiencyState: string; masteryState: string }>
): TierDistribution {
  const tiers: TierDistribution = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
  for (const p of profiles) {
    tiers[classifyProfileTier(p)]++;
  }
  return tiers;
}

function emptyMetrics(): DashboardMetrics {
  return {
    avgMasteryScore: 0,
    avgBaselineGrowth: 0,
    tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    totalStudents: 0,
    activeStudents: 0,
    monthlyReportCompletionRate: 0,
    evidenceSubmissionRate: 0,
    trainingAdoptionRate: 0,
  };
}

// ─── School Aggregation ───────────────────────────────────────────────────────

/**
 * Computes all dashboard metrics for a single school.
 * Tenant-isolated: all queries filter by schoolId.
 */
export async function computeSchoolDashboard(
  schoolId: string
): Promise<DashboardMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Step 1: get all students for this school (needed for subsequent WHERE IN clauses)
  const students = await prisma.student.findMany({
    where: { user: { schoolId } },
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);
  const totalStudents = studentIds.length;

  if (totalStudents === 0) {
    return emptyMetrics();
  }

  // Step 2: all remaining queries in parallel
  const [
    masteryProfiles,
    activeStudentResult,
    studentsWithEvidence,
    teachers,
    completedReportCount,
    totalReportCount,
  ] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        currentScore: true,
        baselineScore: true,
        masteryState: true,
        proficiencyState: true,
        lastAssessedAt: true,
      },
    }),
    // Active: profiles updated within last 30 days (evidence processed)
    prisma.studentMasteryProfile.findMany({
      where: {
        studentId: { in: studentIds },
        lastAssessedAt: { gte: thirtyDaysAgo },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    // Evidence rate: students with any mastery profile (evidence processed ≥ once)
    prisma.studentMasteryProfile.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      select: { id: true },
    }),
    prisma.monthlyReport.count({
      where: {
        scope: "school",
        scopeId: schoolId,
        status: "completed",
        createdAt: { gte: threeMonthsAgo },
      },
    }),
    prisma.monthlyReport.count({
      where: {
        scope: "school",
        scopeId: schoolId,
        createdAt: { gte: threeMonthsAgo },
      },
    }),
  ]);

  const avgMasteryScore = safeAvg(masteryProfiles.map((p) => p.currentScore));
  const avgBaselineGrowth = safeAvg(
    masteryProfiles.map((p) => p.currentScore - p.baselineScore)
  );
  const tierDistribution = computeTierDistribution(masteryProfiles);
  const activeStudents = activeStudentResult.length;
  const evidenceSubmissionRate = safeRate(studentsWithEvidence.length, totalStudents);
  const monthlyReportCompletionRate = safeRate(completedReportCount, totalReportCount);

  // Step 3: training adoption (depends on teachers result from step 2)
  const teacherIds = teachers.map((t) => t.id);
  let trainingAdoptionRate = 0;
  if (teacherIds.length > 0) {
    const teachersWithProgress = await prisma.trainingProgress.groupBy({
      by: ["teacherUserId"],
      where: {
        teacherUserId: { in: teacherIds },
        status: { in: ["in_progress", "complete"] },
      },
    });
    trainingAdoptionRate = safeRate(teachersWithProgress.length, teacherIds.length);
  }

  return {
    avgMasteryScore,
    avgBaselineGrowth,
    tierDistribution,
    totalStudents,
    activeStudents,
    monthlyReportCompletionRate,
    evidenceSubmissionRate,
    trainingAdoptionRate,
  };
}

// ─── National Aggregation ─────────────────────────────────────────────────────

/**
 * Computes dashboard metrics aggregated across all schools.
 * No PII — no school names or student identifiers in the output.
 * Caller must hold isPlatformAdmin or DASHBOARD_NATIONAL_VIEW permission.
 */
export async function computeNationalDashboard(): Promise<DashboardMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Step 1: student count + mastery profiles + active + evidence (all in parallel)
  const [totalStudents, masteryProfiles, activeStudentResult, studentsWithEvidence] =
    await Promise.all([
      prisma.student.count(),
      prisma.studentMasteryProfile.findMany({
        select: {
          currentScore: true,
          baselineScore: true,
          masteryState: true,
          proficiencyState: true,
          lastAssessedAt: true,
        },
      }),
      prisma.studentMasteryProfile.findMany({
        where: { lastAssessedAt: { gte: thirtyDaysAgo } },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      prisma.studentMasteryProfile.findMany({
        select: { studentId: true },
        distinct: ["studentId"],
      }),
    ]);

  if (totalStudents === 0) {
    return emptyMetrics();
  }

  const avgMasteryScore = safeAvg(masteryProfiles.map((p) => p.currentScore));
  const avgBaselineGrowth = safeAvg(
    masteryProfiles.map((p) => p.currentScore - p.baselineScore)
  );
  const tierDistribution = computeTierDistribution(masteryProfiles);
  const activeStudents = activeStudentResult.length;
  const evidenceSubmissionRate = safeRate(studentsWithEvidence.length, totalStudents);

  // Step 2: training + monthly reports (in parallel)
  const [
    totalTeacherCount,
    teachersWithProgressResult,
    completedReportCount,
    totalReportCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.trainingProgress.groupBy({
      by: ["teacherUserId"],
      where: { status: { in: ["in_progress", "complete"] } },
    }),
    prisma.monthlyReport.count({
      where: {
        scope: "school",
        status: "completed",
        createdAt: { gte: threeMonthsAgo },
      },
    }),
    prisma.monthlyReport.count({
      where: {
        scope: "school",
        createdAt: { gte: threeMonthsAgo },
      },
    }),
  ]);

  const trainingAdoptionRate = safeRate(
    teachersWithProgressResult.length,
    totalTeacherCount
  );
  const monthlyReportCompletionRate = safeRate(completedReportCount, totalReportCount);

  return {
    avgMasteryScore,
    avgBaselineGrowth,
    tierDistribution,
    totalStudents,
    activeStudents,
    monthlyReportCompletionRate,
    evidenceSubmissionRate,
    trainingAdoptionRate,
  };
}
