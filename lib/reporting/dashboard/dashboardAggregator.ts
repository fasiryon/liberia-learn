import { prisma } from "@/lib/db";
import { getTrainingSummary } from "@/lib/reporting/training";

export type SchoolDashboardMetrics = {
  avgMasteryScore: number;
  trainingAdoptionRate: number;
  evidenceSubmissionRate: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function safeAvg(total: number | null | undefined, count: number): number {
  if (!total || !count) return 0;
  return total / count;
}

export async function computeSchoolDashboard(params: {
  tenantId: string;
  schoolId: string;
}): Promise<SchoolDashboardMetrics> {
  const { schoolId } = params;

  const masteryAgg = await prisma.studentMasteryProfile.aggregate({
    where: {
      student: {
        user: { schoolId },
      },
    },
    _avg: { currentScore: true },
    _count: { _all: true },
  });

  const avgMasteryScore = clamp01(
    safeAvg(masteryAgg._avg.currentScore ?? 0, masteryAgg._count._all ?? 0)
  );

  const training = await getTrainingSummary({
    scope: "school",
    scopeId: schoolId,
    pilotOnly: true,
  });

  const trainingAdoptionRate = clamp01(training.totals.completionRate);

  const submissions = await prisma.assignmentSubmission.count({
    where: {
      Assignment: { Class: { schoolId } },
    },
  });

  const assignments = await prisma.assignment.count({
    where: { Class: { schoolId } },
  });

  const evidenceSubmissionRate = clamp01(
    assignments > 0 ? submissions / assignments : 0
  );

  return {
    avgMasteryScore,
    trainingAdoptionRate,
    evidenceSubmissionRate,
  };
}
