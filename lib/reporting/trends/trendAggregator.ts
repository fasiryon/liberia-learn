import { prisma } from "@/lib/db";
import type { TrendBucket, TrendSeries } from "@/lib/reporting/trends/types";

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function quarterKey(d: Date): string {
  const year = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${year}-Q${q}`;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1);
}

function buildMonthlyBuckets(lookbackMonths: number, now: Date): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let i = lookbackMonths - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: monthKey(d),
    });
  }
  return buckets;
}

function buildQuarterlyBuckets(lookbackMonths: number, now: Date): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  const totalMonths = Math.max(1, lookbackMonths);
  const bucketCount = Math.ceil(totalMonths / 3);
  for (let i = bucketCount - 1; i >= 0; i--) {
    const endMonthOffset = i * 3;
    const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - endMonthOffset, 1));
    const startMonth = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - 2, 1));
    buckets.push({
      start: startOfMonth(startMonth),
      end: endOfMonth(endMonth),
      label: quarterKey(endMonth),
    });
  }
  return buckets;
}

function toTrendBuckets(labels: string[]): TrendBucket[] {
  return labels.map((label) => ({ period: label, value: null }));
}

export async function computeSchoolTrends(params: {
  tenantId: string;
  schoolId: string;
  period: "monthly" | "quarterly";
  lookbackMonths: number;
}): Promise<TrendSeries> {
  const { schoolId, period, lookbackMonths } = params;
  const now = new Date();
  const buckets = period === "quarterly"
    ? buildQuarterlyBuckets(lookbackMonths, now)
    : buildMonthlyBuckets(lookbackMonths, now);

  const masteryTrend: TrendBucket[] = toTrendBuckets(buckets.map((b) => b.label));
  const evidenceVelocityTrend: TrendBucket[] = toTrendBuckets(buckets.map((b) => b.label));

  for (let i = 0; i < buckets.length; i++) {
    const { start, end } = buckets[i];

    const masteryAgg = await prisma.studentMasteryProfile.aggregate({
      where: {
        student: { user: { schoolId } },
        lastAssessedAt: { gte: start, lte: end },
      },
      _avg: { currentScore: true },
      _count: { _all: true },
    });

    const masteryCount = masteryAgg._count._all ?? 0;
    masteryTrend[i].value = masteryCount > 0
      ? (masteryAgg._avg.currentScore ?? 0)
      : null;

    const evidenceCount = await prisma.assignmentSubmission.count({
      where: {
        Assignment: { Class: { schoolId } },
        turnedInAt: { gte: start, lte: end },
      },
    });

    evidenceVelocityTrend[i].value = evidenceCount > 0 ? evidenceCount : null;
  }

  return {
    period,
    masteryTrend,
    evidenceVelocityTrend,
  };
}
