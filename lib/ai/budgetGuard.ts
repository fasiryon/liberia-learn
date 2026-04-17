import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getAiBudgetDailyCap,
  getAiBudgetMonthlyCap,
  getAiCurriculumDailyBudgetUsd,
  getAiGradingDailyBudgetUsd,
  getAiLabsDailyBudgetUsd,
  getAiTeacherAssistDailyBudgetUsd,
  getAiTutorDailyBudgetUsd,
} from "@/lib/serverFlags";
import { type AiBudgetFeature } from "@/lib/ai/interactionLog";

export type BudgetResult = {
  allowed: boolean;
  remaining: number;
  dailyUsed: number;
  dailyCap: number;
  monthlyUsed: number;
  monthlyCap: number;
  fallbackReason?: "daily_cap_reached" | "monthly_cap_reached";
};

function getStartOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFeatureDailyCap(feature: AiBudgetFeature) {
  switch (feature) {
    case "tutor":
      return getAiTutorDailyBudgetUsd();
    case "teacherAssist":
      return getAiTeacherAssistDailyBudgetUsd();
    case "grading":
      return getAiGradingDailyBudgetUsd();
    case "curriculum":
      return getAiCurriculumDailyBudgetUsd();
    case "labs":
      return getAiLabsDailyBudgetUsd();
  }
}

export async function checkBudget(feature: AiBudgetFeature, schoolId?: string | null): Promise<BudgetResult> {
  const aiInteractionLogModel = (prisma as typeof prisma & {
    aiInteractionLog?: { aggregate?: (args: unknown) => Promise<any> };
  }).aiInteractionLog;

  const dailyCap = Math.min(getFeatureDailyCap(feature), getAiBudgetDailyCap());
  const monthlyCap = getAiBudgetMonthlyCap();

  if (!aiInteractionLogModel?.aggregate) {
    return {
      allowed: true,
      remaining: Math.min(dailyCap, monthlyCap),
      dailyUsed: 0,
      dailyCap,
      monthlyUsed: 0,
      monthlyCap,
    };
  }

  try {
    const [dailyResult, monthlyResult] = await Promise.all([
      aiInteractionLogModel.aggregate({
        where: {
          feature,
          timestamp: { gte: getStartOfDay() },
          ...(schoolId ? { schoolId } : {}),
        },
        _sum: { estimatedCostUSD: true },
      }),
      aiInteractionLogModel.aggregate({
        where: { timestamp: { gte: getStartOfMonth() } },
        _sum: { estimatedCostUSD: true },
      }),
    ]);

    const dailyUsed = Number(dailyResult?._sum?.estimatedCostUSD ?? 0);
    const monthlyUsed = Number(monthlyResult?._sum?.estimatedCostUSD ?? 0);

    if (dailyUsed >= dailyCap * 0.8) {
      logger.warn("[AI_BUDGET] feature approaching daily cap", {
        feature,
        used: dailyUsed,
        cap: dailyCap,
        schoolId: schoolId ?? null,
      });
    }

    if (monthlyUsed >= monthlyCap * 0.9) {
      logger.error("[AI_BUDGET] platform approaching monthly cap", {
        used: monthlyUsed,
        cap: monthlyCap,
      });
    }

    const remaining = Math.max(
      0,
      Math.min(dailyCap - dailyUsed, monthlyCap - monthlyUsed)
    );

    if (monthlyUsed >= monthlyCap) {
      return {
        allowed: false,
        remaining,
        dailyUsed,
        dailyCap,
        monthlyUsed,
        monthlyCap,
        fallbackReason: "monthly_cap_reached",
      };
    }

    if (dailyUsed >= dailyCap) {
      return {
        allowed: false,
        remaining,
        dailyUsed,
        dailyCap,
        monthlyUsed,
        monthlyCap,
        fallbackReason: "daily_cap_reached",
      };
    }

    return {
      allowed: true,
      remaining,
      dailyUsed,
      dailyCap,
      monthlyUsed,
      monthlyCap,
    };
  } catch (error) {
    logger.warn("[AI_BUDGET] budget check failed open", {
      feature,
      schoolId: schoolId ?? null,
      error,
    });

    return {
      allowed: true,
      remaining: Math.min(dailyCap, monthlyCap),
      dailyUsed: 0,
      dailyCap,
      monthlyUsed: 0,
      monthlyCap,
    };
  }
}
