import { prisma } from "@/lib/db";
import { getAiBudgetDailyCap, getAiBudgetMonthlyCap } from "@/lib/serverFlags";
import type { AiBudgetFeature } from "@/lib/ai/interactionLog";

export type FeatureSpend = { feature: string; costUsd: number };

export type SpendSnapshot = {
  todayUsd: number;
  mtdUsd: number;
  dailyCap: number;
  monthlyCap: number;
  dailyPct: number;
  monthlyPct: number;
  status: "green" | "yellow" | "red";
  byFeature: FeatureSpend[];
};

const FEATURES: AiBudgetFeature[] = [
  "curriculum",
  "tutor",
  "grading",
  "labs",
  "teacherAssist",
];

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getAISpend(): Promise<SpendSnapshot> {
  const dailyCap = getAiBudgetDailyCap();
  const monthlyCap = getAiBudgetMonthlyCap();
  const today = startOfDay();
  const monthStart = startOfMonth();

  try {
    const aiLog = (prisma as any).aiInteractionLog;
    if (!aiLog?.aggregate) {
      return emptySnapshot(dailyCap, monthlyCap);
    }

    const [todayAgg, mtdAgg, byFeatureRaw] = await Promise.all([
      aiLog.aggregate({
        where: { timestamp: { gte: today } },
        _sum: { estimatedCostUSD: true },
      }),
      aiLog.aggregate({
        where: { timestamp: { gte: monthStart } },
        _sum: { estimatedCostUSD: true },
      }),
      Promise.all(
        FEATURES.map((feature) =>
          aiLog
            .aggregate({
              where: { feature, timestamp: { gte: today } },
              _sum: { estimatedCostUSD: true },
            })
            .then((r: any) => ({
              feature,
              costUsd: Number(r?._sum?.estimatedCostUSD ?? 0),
            }))
        )
      ),
    ]);

    const todayUsd = Number(todayAgg?._sum?.estimatedCostUSD ?? 0);
    const mtdUsd = Number(mtdAgg?._sum?.estimatedCostUSD ?? 0);
    const dailyPct = dailyCap > 0 ? (todayUsd / dailyCap) * 100 : 0;
    const monthlyPct = monthlyCap > 0 ? (mtdUsd / monthlyCap) * 100 : 0;

    const status =
      dailyPct >= 90 || monthlyPct >= 80
        ? "red"
        : dailyPct >= 70 || monthlyPct >= 60
        ? "yellow"
        : "green";

    return {
      todayUsd,
      mtdUsd,
      dailyCap,
      monthlyCap,
      dailyPct: Math.round(dailyPct * 10) / 10,
      monthlyPct: Math.round(monthlyPct * 10) / 10,
      status,
      byFeature: (byFeatureRaw as FeatureSpend[]).filter((f) => f.costUsd > 0),
    };
  } catch {
    return emptySnapshot(dailyCap, monthlyCap);
  }
}

function emptySnapshot(dailyCap: number, monthlyCap: number): SpendSnapshot {
  return {
    todayUsd: 0,
    mtdUsd: 0,
    dailyCap,
    monthlyCap,
    dailyPct: 0,
    monthlyPct: 0,
    status: "green",
    byFeature: [],
  };
}
