import type { LiberianCounty } from "@/lib/counties";
import type { GeoPerformanceResult } from "@/lib/reporting/geo/geoAggregator";
import type { NationalCurriculumSignals } from "@/lib/reporting/curriculum/nationalCurriculumSignals";

export type BenchmarkStats = {
  avg: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  sampleSize: number;
};

export type InsightCard = {
  id: string;
  title: string;
  severity: "info" | "warning";
  summary: string;
  value: number | null;
  unit: "count";
  hasData: boolean;
};

export type NationalInsights = {
  hasData: boolean;
  topImprovingCounties: Array<{
    county: LiberianCounty;
    hasData: boolean;
    metrics: {
      masteryAvg: number | null;
      growthAvg: number | null;
      atRiskPct: number | null;
      attendanceProxyAvg: number | null;
    };
  }>;
  topDecliningCounties: Array<{
    county: LiberianCounty;
    hasData: boolean;
    metrics: {
      masteryAvg: number | null;
      growthAvg: number | null;
      atRiskPct: number | null;
      attendanceProxyAvg: number | null;
    };
  }>;
  benchmarks: {
    masteryAvg: BenchmarkStats;
    growthAvg: BenchmarkStats;
    atRiskPct: BenchmarkStats;
    attendanceProxyAvg: BenchmarkStats;
  };
  insights: InsightCard[];
  sources: {
    geoCountiesWithData: number;
    curriculumEligibleStrands: number;
  };
};

const TOP_COUNT = 5;
const STEM_SUBJECTS = new Set([
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
]);

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return round4(sum / values.length);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return round4(sorted[idx]);
}

function buildBenchmarks(values: number[]): BenchmarkStats {
  return {
    avg: average(values),
    median: percentile(values, 0.5),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    sampleSize: values.length,
  };
}

function metricValues(
  geo: GeoPerformanceResult,
  key: "masteryAvg" | "growthAvg" | "atRiskPct" | "attendanceProxyAvg"
): number[] {
  return geo.counties
    .map((county) => county.metrics[key])
    .filter((value): value is number => typeof value === "number");
}

function sortCountiesByGrowth(
  direction: "improving" | "declining",
  counties: GeoPerformanceResult["counties"]
) {
  const filtered = counties.filter((row) => typeof row.metrics.growthAvg === "number");
  return filtered.sort((a, b) => {
    const aGrowth = a.metrics.growthAvg ?? 0;
    const bGrowth = b.metrics.growthAvg ?? 0;
    if (aGrowth !== bGrowth) {
      return direction === "improving" ? bGrowth - aGrowth : aGrowth - bGrowth;
    }
    const aMastery = a.metrics.masteryAvg ?? -1;
    const bMastery = b.metrics.masteryAvg ?? -1;
    if (aMastery !== bMastery) {
      return direction === "improving" ? bMastery - aMastery : aMastery - bMastery;
    }
    return a.county.localeCompare(b.county);
  });
}

function buildInsightCards(params: {
  geo: GeoPerformanceResult;
  benchmarks: NationalInsights["benchmarks"];
  curriculum: NationalCurriculumSignals;
}): InsightCard[] {
  const { geo, benchmarks, curriculum } = params;

  const attendanceLow = benchmarks.attendanceProxyAvg.p25;
  const growthLow = benchmarks.growthAvg.p25;
  const masteryHigh = benchmarks.masteryAvg.p75;
  const growthHigh = benchmarks.growthAvg.p75;

  const countyLowAttendanceLowGrowth =
    attendanceLow == null || growthLow == null
      ? null
      : geo.counties.filter(
          (county) =>
            typeof county.metrics.attendanceProxyAvg === "number" &&
            typeof county.metrics.growthAvg === "number" &&
            county.metrics.attendanceProxyAvg <= attendanceLow &&
            county.metrics.growthAvg <= growthLow
        ).length;

  const countyHighMasteryHighGrowth =
    masteryHigh == null || growthHigh == null
      ? null
      : geo.counties.filter(
          (county) =>
            typeof county.metrics.masteryAvg === "number" &&
            typeof county.metrics.growthAvg === "number" &&
            county.metrics.masteryAvg >= masteryHigh &&
            county.metrics.growthAvg >= growthHigh
        ).length;

  const stemRows = curriculum.rows.filter((row) => STEM_SUBJECTS.has(row.subject));
  const stemImproving =
    stemRows.length === 0
      ? null
      : stemRows.filter((row) => row.trendDirection === "improving").length;
  const stemDeclining =
    stemRows.length === 0
      ? null
      : stemRows.filter((row) => row.trendDirection === "declining").length;

  return [
    {
      id: "low_attendance_low_growth",
      title: "Low attendance and low growth",
      severity: "warning",
      summary:
        countyLowAttendanceLowGrowth == null
          ? "Insufficient data to evaluate attendance vs. growth."
          : `${countyLowAttendanceLowGrowth} counties sit below the 25th percentile for both attendance and growth.`,
      value: countyLowAttendanceLowGrowth,
      unit: "count",
      hasData: countyLowAttendanceLowGrowth != null,
    },
    {
      id: "high_mastery_high_growth",
      title: "High mastery and high growth",
      severity: "info",
      summary:
        countyHighMasteryHighGrowth == null
          ? "Insufficient data to evaluate mastery vs. growth."
          : `${countyHighMasteryHighGrowth} counties exceed the 75th percentile for both mastery and growth.`,
      value: countyHighMasteryHighGrowth,
      unit: "count",
      hasData: countyHighMasteryHighGrowth != null,
    },
    {
      id: "stem_improving_strands",
      title: "STEM strands improving",
      severity: "info",
      summary:
        stemImproving == null
          ? "No STEM strand data available."
          : `${stemImproving} STEM strands show improving mastery trends nationally.`,
      value: stemImproving,
      unit: "count",
      hasData: stemImproving != null,
    },
    {
      id: "stem_declining_strands",
      title: "STEM strands declining",
      severity: "warning",
      summary:
        stemDeclining == null
          ? "No STEM strand data available."
          : `${stemDeclining} STEM strands show declining mastery trends nationally.`,
      value: stemDeclining,
      unit: "count",
      hasData: stemDeclining != null,
    },
  ];
}

export function buildNationalInsights(params: {
  geo: GeoPerformanceResult;
  curriculum: NationalCurriculumSignals;
}): NationalInsights {
  const { geo, curriculum } = params;

  const masteryValues = metricValues(geo, "masteryAvg");
  const growthValues = metricValues(geo, "growthAvg");
  const atRiskValues = metricValues(geo, "atRiskPct");
  const attendanceValues = metricValues(geo, "attendanceProxyAvg");

  const benchmarks = {
    masteryAvg: buildBenchmarks(masteryValues),
    growthAvg: buildBenchmarks(growthValues),
    atRiskPct: buildBenchmarks(atRiskValues),
    attendanceProxyAvg: buildBenchmarks(attendanceValues),
  };

  const improving = sortCountiesByGrowth("improving", geo.counties).slice(0, TOP_COUNT);
  const declining = sortCountiesByGrowth("declining", geo.counties).slice(0, TOP_COUNT);

  const geoCountiesWithData = geo.counties.filter((county) => county.hasData).length;
  const curriculumEligibleStrands = curriculum.summary.eligibleStrandCount;

  const hasData = geoCountiesWithData > 0 || curriculumEligibleStrands > 0;

  return {
    hasData,
    topImprovingCounties: improving.map((county) => ({
      county: county.county,
      hasData: county.hasData,
      metrics: county.metrics,
    })),
    topDecliningCounties: declining.map((county) => ({
      county: county.county,
      hasData: county.hasData,
      metrics: county.metrics,
    })),
    benchmarks,
    insights: buildInsightCards({ geo, benchmarks, curriculum }),
    sources: {
      geoCountiesWithData,
      curriculumEligibleStrands,
    },
  };
}
