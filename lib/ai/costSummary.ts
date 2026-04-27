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
    costPerInteraction: number;
    byFeature: ByFeatureSummary;
    topSchoolsBySpend: Array<{ schoolId: string; name: string; costUsd: number }>;
  };
  thisMonth: {
    totalCostUsd: number;
    budgetCapUsd: number;
    percentUsed: number;
    projectedMonthEndUsd: number;
  };
  sevenDayTrend: Array<{ date: string; costUsd: number; requestCount: number }>;
  recommendations: string[];
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

function startOfDayOffset(daysAgo: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildRecommendations(input: {
  fallbackRate: number;
  costPerInteraction: number;
  curriculumFraction: number;
  totalCostUsd: number;
}): string[] {
  const recs: string[] = [];
  if (input.fallbackRate > 0.15) {
    recs.push("High fallback rate detected — review high-error AI call sites to improve reliability.");
  }
  if (input.costPerInteraction > 0.01) {
    recs.push("Cost per interaction is above $0.01 — consider enabling response caching for repeated curriculum queries.");
  }
  if (input.curriculumFraction > 0.5 && input.totalCostUsd > 0.5) {
    recs.push("Curriculum generation accounts for over half of AI spend — limit long-form generation to batch workflows.");
  }
  recs.push("Use the fast (Groq) tier for simple student questions where available.");
  recs.push("Review AI usage weekly — costs rise faster than usage when models are called on cached/repeated requests.");
  return recs;
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
        costPerInteraction: 0,
        byFeature: emptyByFeature(),
        topSchoolsBySpend: [],
      },
      thisMonth: {
        totalCostUsd: 0,
        budgetCapUsd: monthlyCap,
        percentUsed: 0,
        projectedMonthEndUsd: 0,
      },
      sevenDayTrend: [],
      recommendations: buildRecommendations({ fallbackRate: 0, costPerInteraction: 0, curriculumFraction: 0, totalCostUsd: 0 }),
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

  const sevenDayTrendRaw = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const dayStart = startOfDayOffset(6 - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      return Promise.all([
        aiInteractionLogModel.aggregate!({
          where: { ...whereScope, timestamp: { gte: dayStart, lt: dayEnd } },
          _sum: { estimatedCostUSD: true },
        }),
        (aiInteractionLogModel.count?.({
          where: { ...whereScope, timestamp: { gte: dayStart, lt: dayEnd } },
        }) ?? Promise.resolve(0)),
        Promise.resolve(isoDateOnly(dayStart)),
      ]).catch(() => [null, 0, isoDateOnly(dayStart)] as const);
    })
  );

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

  const todayFallbackRate =
    todayRequestCount > 0 ? Number(todayFallbackCount ?? 0) / todayRequestCount : 0;
  const costPerInteraction =
    todayRequestCount > 0 ? todayCost / todayRequestCount : 0;
  const curriculumFraction =
    todayCost > 0 ? byFeature.curriculum.costUsd / todayCost : 0;

  const sevenDayTrend = sevenDayTrendRaw.map((entry) => {
    const [totals, count, date] = entry as [any, number, string];
    return {
      date,
      costUsd: Number(totals?._sum?.estimatedCostUSD ?? 0),
      requestCount: Number(count ?? 0),
    };
  });

  const recommendations = buildRecommendations({
    fallbackRate: todayFallbackRate,
    costPerInteraction,
    curriculumFraction,
    totalCostUsd: todayCost,
  });

  return {
    today: {
      totalCostUsd: todayCost,
      totalTokens: Number(todayTotals?._sum?.tokensUsed ?? 0),
      requestCount: todayRequestCount,
      fallbackCount: Number(todayFallbackCount ?? 0),
      fallbackRate: todayFallbackRate,
      costPerInteraction,
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
    sevenDayTrend,
    recommendations,
    alerts,
  };
}
