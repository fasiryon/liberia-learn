import { prisma } from "@/lib/db";
import {
  getAiBudgetDailyCap,
  getAiBudgetMonthlyCap,
  getAiCurriculumDailyBudgetUsd,
  getAiGradingDailyBudgetUsd,
  getAiLabsDailyBudgetUsd,
  getAiTeacherAssistDailyBudgetUsd,
  getAiTutorDailyBudgetUsd,
} from "@/lib/serverFlags";
import type { AiBudgetFeature } from "@/lib/ai/interactionLog";

type AiCostScope = {
  schoolId?: string | null;
  isPlatformAdmin: boolean;
};

type ByFeatureSummary = Record<
  AiBudgetFeature,
  { costUsd: number; tokensUsed: number; requestCount: number; fallbackCount: number }
>;

export type AiCostDashboardData = {
  today: {
    totalCostUsd: number;
    totalTokens: number;
    requestCount: number;
    fallbackCount: number;
    fallbackRate: number;
    byFeature: ByFeatureSummary;
    topSchoolsBySpend: Array<{ schoolId: string; name: string; costUsd: number }>;
  };
  thisMonth: {
    totalCostUsd: number;
    budgetCapUsd: number;
    percentUsed: number;
    projectedMonthEndUsd: number;
  };
  alerts: string[];
};

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTodayProgress(now: Date) {
  const start = startOfMonth();
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  const elapsed = Math.max(now.getTime() - start.getTime(), 1);
  const total = Math.max(next.getTime() - start.getTime(), 1);
  return elapsed / total;
}

function emptyByFeature(): ByFeatureSummary {
  return {
    tutor: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
    teacherAssist: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
    grading: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
    curriculum: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
    labs: { costUsd: 0, tokensUsed: 0, requestCount: 0, fallbackCount: 0 },
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return value;
}

export async function getAiCostDashboardData(
  scope: AiCostScope
): Promise<AiCostDashboardData> {
  const aiInteractionLogModel = (prisma as any).aiInteractionLog as
    | {
        aggregate?: (args: unknown) => Promise<any>;
        count?: (args: unknown) => Promise<number>;
        groupBy?: (args: unknown) => Promise<any[]>;
      }
    | undefined;

  const schoolModel = (prisma as any).school as
    | {
        findMany?: (args: unknown) => Promise<Array<{ id: string; name: string }>>;
      }
    | undefined;

  const monthlyCap = getAiBudgetMonthlyCap();
  const now = new Date();
  const today = startOfDay();
  const month = startOfMonth();
  const whereScope =
    scope.isPlatformAdmin || !scope.schoolId ? {} : { schoolId: scope.schoolId };

  if (!aiInteractionLogModel?.aggregate || !aiInteractionLogModel?.groupBy) {
    return {
      today: {
        totalCostUsd: 0,
        totalTokens: 0,
        requestCount: 0,
        fallbackCount: 0,
        fallbackRate: 0,
        byFeature: emptyByFeature(),
        topSchoolsBySpend: [],
      },
      thisMonth: {
        totalCostUsd: 0,
        budgetCapUsd: monthlyCap,
        percentUsed: 0,
        projectedMonthEndUsd: 0,
      },
      alerts: [],
    };
  }

  const [todayTotals, todayFallbackCount, monthTotals, byFeatureRows, topSchoolRows] =
    await Promise.all([
      aiInteractionLogModel.aggregate({
        where: { ...whereScope, timestamp: { gte: today } },
        _sum: { estimatedCostUSD: true, tokensUsed: true },
      }),
      aiInteractionLogModel.count?.({
        where: { ...whereScope, timestamp: { gte: today }, hadFallback: true },
      }) ?? Promise.resolve(0),
      aiInteractionLogModel.aggregate({
        where: { ...whereScope, timestamp: { gte: month } },
        _sum: { estimatedCostUSD: true },
      }),
      aiInteractionLogModel.groupBy({
        by: ["feature"],
        where: { ...whereScope, timestamp: { gte: today } },
        _sum: { estimatedCostUSD: true, tokensUsed: true },
        _count: { _all: true },
      }),
      scope.isPlatformAdmin
        ? aiInteractionLogModel.groupBy({
            by: ["schoolId"],
            where: { timestamp: { gte: today }, schoolId: { not: null } },
            _sum: { estimatedCostUSD: true },
            orderBy: { _sum: { estimatedCostUSD: "desc" } },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

  const todayRequestCount = byFeatureRows.reduce(
    (sum, row) => sum + Number(row?._count?._all ?? 0),
    0
  );
  const todayCost = Number(todayTotals?._sum?.estimatedCostUSD ?? 0);
  const monthCost = Number(monthTotals?._sum?.estimatedCostUSD ?? 0);
  const byFeature = emptyByFeature();

  for (const row of byFeatureRows) {
    const feature = row.feature as AiBudgetFeature | null;
    if (!feature || !(feature in byFeature)) continue;
    byFeature[feature] = {
      costUsd: Number(row?._sum?.estimatedCostUSD ?? 0),
      tokensUsed: Number(row?._sum?.tokensUsed ?? 0),
      requestCount: Number(row?._count?._all ?? 0),
      fallbackCount: await (aiInteractionLogModel.count?.({
        where: {
          ...whereScope,
          timestamp: { gte: today },
          feature,
          hadFallback: true,
        },
      }) ?? Promise.resolve(0)),
    };
  }

  const schoolNames = new Map<string, string>();
  if (scope.isPlatformAdmin && topSchoolRows.length > 0 && schoolModel?.findMany) {
    const ids = topSchoolRows
      .map((row) => row.schoolId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const schools = await schoolModel.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    for (const school of schools) {
      schoolNames.set(school.id, school.name);
    }
  }

  const alerts: string[] = [];
  const tutorDailyCap = Math.min(getAiTutorDailyBudgetUsd(), getAiBudgetDailyCap());
  const teacherDailyCap = Math.min(getAiTeacherAssistDailyBudgetUsd(), getAiBudgetDailyCap());
  const gradingDailyCap = Math.min(getAiGradingDailyBudgetUsd(), getAiBudgetDailyCap());
  const curriculumDailyCap = Math.min(getAiCurriculumDailyBudgetUsd(), getAiBudgetDailyCap());
  const labsDailyCap = Math.min(getAiLabsDailyBudgetUsd(), getAiBudgetDailyCap());

  if (byFeature.tutor.costUsd >= tutorDailyCap * 0.8) {
    alerts.push("Tutor AI spend is above 80% of its daily budget.");
  }
  if (byFeature.teacherAssist.costUsd >= teacherDailyCap * 0.8) {
    alerts.push("Teacher assist AI spend is above 80% of its daily budget.");
  }
  if (byFeature.grading.costUsd >= gradingDailyCap * 0.8) {
    alerts.push("Grading AI spend is above 80% of its daily budget.");
  }
  if (byFeature.curriculum.costUsd >= curriculumDailyCap * 0.8) {
    alerts.push("Curriculum AI spend is above 80% of its daily budget.");
  }
  if (byFeature.labs.costUsd >= labsDailyCap * 0.8) {
    alerts.push("AI Labs spend is above 80% of its daily budget.");
  }
  if (monthCost >= monthlyCap * 0.9) {
    alerts.push("Platform AI spend is above 90% of the monthly cap.");
  }

  return {
    today: {
      totalCostUsd: todayCost,
      totalTokens: Number(todayTotals?._sum?.tokensUsed ?? 0),
      requestCount: todayRequestCount,
      fallbackCount: Number(todayFallbackCount ?? 0),
      fallbackRate: todayRequestCount > 0 ? Number(todayFallbackCount ?? 0) / todayRequestCount : 0,
      byFeature,
      topSchoolsBySpend: topSchoolRows.map((row) => ({
        schoolId: String(row.schoolId),
        name: schoolNames.get(String(row.schoolId)) ?? "Unknown school",
        costUsd: Number(row?._sum?.estimatedCostUSD ?? 0),
      })),
    },
    thisMonth: {
      totalCostUsd: monthCost,
      budgetCapUsd: monthlyCap,
      percentUsed: clampPercent((monthCost / Math.max(monthlyCap, 1)) * 100),
      projectedMonthEndUsd: Number((monthCost / getTodayProgress(now)).toFixed(4)),
    },
    alerts,
  };
}
