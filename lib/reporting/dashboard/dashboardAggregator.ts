/**
 * lib/reporting/dashboard/dashboardAggregator.ts â€” Block 9: Dashboard Aggregation
 *
 * Computes leadership-ready dashboard metrics for school and national scopes.
 * No PII is returned â€” all outputs are aggregated counts and rates.
 *
 * Tier distribution source of truth:
 *   Derived from StudentMasteryProfile.proficiencyState and .masteryState,
 *   which are computed by lib/mastery/masteryService.ts using the thresholds
 *   in lib/mastery/compute.ts. Tier labels (bronze/silver/gold/platinum) map
 *   directly to these pre-computed states â€” no independent threshold values.
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
 *   - monthlyReportExportShareLast90Days uses ExportRecord as a proxy (no MonthlyReport
 *     table exists yet). Rate = monthly_report exports / all school-scope exports.
 *     Block 10 will introduce a dedicated submission-tracking table.
 */

import { prisma } from "@/lib/db";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  monthlyReportExportShareLast90Days: number;
    // Proxy metric: (monthly_report exports in last 90 days) / (all school-scope exports in last 90 days).
    // This is NOT a submission/completion rate. Block 10 will add explicit submission tracking with status. (placeholder)
  evidenceSubmissionRate: number;
  trainingAdoptionRate: number;
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
 *   Platinum â€” masteryState = MASTERED (sustained â‰¥85% across spaced assessments)
 *   Gold     â€” proficiencyState = PROFICIENT, masteryState â‰  MASTERED (â‰¥75% accuracy)
 *   Silver   â€” proficiencyState = APPROACHING (â‰¥60% accuracy)
 *   Bronze   â€” proficiencyState = BELOW_PROFICIENT or NOT_ASSESSED
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
    monthlyReportExportShareLast90Days: 0,
    // Proxy metric: (monthly_report exports in last 90 days) / (all school-scope exports in last 90 days).
    // This is NOT a submission/completion rate. Block 10 will add explicit submission tracking with status. (placeholder)
    evidenceSubmissionRate: 0,
    trainingAdoptionRate: 0,
  };
}

// â”€â”€â”€ School Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    // Evidence rate: students with any mastery profile (evidence processed â‰¥ once)
    prisma.studentMasteryProfile.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      select: { id: true },
    }),
    // Monthly report completion proxy: ExportRecord tracks every generated
    // monthly report export. "Completed" = exportType "monthly_report" was
    // generated. "Total" = all school-scope exports in period.
    // Block 10: replace with a dedicated MonthlyReportRecord table that tracks
    // submission status independently of export generation.
    prisma.exportRecord.count({
      where: {
        exportType: "monthly_report",
        scope: "school",
        scopeId: schoolId,
        createdAt: { gte: threeMonthsAgo },
      },
    }),
    prisma.exportRecord.count({
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
  const monthlyReportExportShareLast90Days = safeRate(completedReportCount, totalReportCount);

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
    monthlyReportExportShareLast90Days,
    evidenceSubmissionRate,
    trainingAdoptionRate,
  };
}

// â”€â”€â”€ National Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Computes dashboard metrics aggregated across all schools.
 * No PII â€” no school names or student identifiers in the output.
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
    // Same proxy as school scope: monthly_report exports / all school-scope exports.
    prisma.exportRecord.count({
      where: {
        exportType: "monthly_report",
        scope: "school",
        createdAt: { gte: threeMonthsAgo },
      },
    }),
    prisma.exportRecord.count({
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
  const monthlyReportExportShareLast90Days = safeRate(completedReportCount, totalReportCount);

  return {
    avgMasteryScore,
    avgBaselineGrowth,
    tierDistribution,
    totalStudents,
    activeStudents,
    monthlyReportExportShareLast90Days,
    evidenceSubmissionRate,
    trainingAdoptionRate,
  };
}

