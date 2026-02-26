import { prisma } from "@/lib/db";
import type { TrendSeries, TrendBucket } from "@/lib/reporting/trends/types";
import { computeSchoolTrends } from "@/lib/reporting/trends/trendAggregator";

function average(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((acc, v) => acc + v, 0);
  return total / values.length;
}

function aggregateBuckets(series: TrendSeries[]): { masteryTrend: TrendBucket[]; evidenceVelocityTrend: TrendBucket[] } {
  if (!series.length) {
    return { masteryTrend: [], evidenceVelocityTrend: [] };
  }

  const length = series[0].masteryTrend.length;
  const masteryTrend: TrendBucket[] = [];
  const evidenceVelocityTrend: TrendBucket[] = [];

  for (let i = 0; i < length; i++) {
    const masteryValues = series
      .map((s) => s.masteryTrend[i]?.value)
      .filter((v): v is number => typeof v === "number");
    const evidenceValues = series
      .map((s) => s.evidenceVelocityTrend[i]?.value)
      .filter((v): v is number => typeof v === "number");

    masteryTrend.push({
      period: series[0].masteryTrend[i]?.period ?? "",
      value: masteryValues.length ? average(masteryValues) : null,
    });
    evidenceVelocityTrend.push({
      period: series[0].evidenceVelocityTrend[i]?.period ?? "",
      value: evidenceValues.length ? average(evidenceValues) : null,
    });
  }

  return { masteryTrend, evidenceVelocityTrend };
}

export async function computeDistrictTrends(params: {
  tenantId: string;
  districtId: string;
  period: "monthly" | "quarterly";
  lookbackMonths: number;
}): Promise<TrendSeries> {
  const { tenantId, districtId, period, lookbackMonths } = params;

  const schools = await prisma.school.findMany({
    where: { districtId },
    select: { id: true },
  });

  if (schools.length === 0) {
    const empty = await computeSchoolTrends({
      tenantId,
      schoolId: "__empty__",
      period,
      lookbackMonths,
    }).catch(() => ({ period, masteryTrend: [], evidenceVelocityTrend: [] } as TrendSeries));

    return {
      period,
      masteryTrend: empty.masteryTrend.map((b) => ({ ...b, value: null })),
      evidenceVelocityTrend: empty.evidenceVelocityTrend.map((b) => ({ ...b, value: null })),
    };
  }

  const series = await Promise.all(
    schools.map((s) =>
      computeSchoolTrends({
        tenantId,
        schoolId: s.id,
        period,
        lookbackMonths,
      })
    )
  );

  const aggregated = aggregateBuckets(series);

  return {
    period,
    masteryTrend: aggregated.masteryTrend,
    evidenceVelocityTrend: aggregated.evidenceVelocityTrend,
  };
}
