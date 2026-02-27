import { prisma } from "@/lib/db";
import type { LiberianCounty } from "@/lib/counties";
import { isValidPeriod } from "@/lib/metrics/impact/impactEngine";
import { GEO_COUNTIES } from "@/lib/reporting/geo/counties";

export type GeoCountyPerformance = {
  county: LiberianCounty;
  hasData: boolean;
  metrics: {
    masteryAvg: number | null;
    growthAvg: number | null;
    atRiskPct: number | null;
    attendanceProxyAvg: number | null;
  };
};

export type GeoPerformanceResult = {
  period: { from: string; to: string };
  counties: GeoCountyPerformance[];
};

type CountyAccumulator = {
  masterySum: number;
  masteryCount: number;
  growthSum: number;
  growthCount: number;
  atRiskCount: number;
  atRiskTotal: number;
  attendancePresent: number;
  attendanceTotal: number;
};

const COUNTY_LOOKUP = new Map(
  GEO_COUNTIES.map((county) => [county.toLowerCase(), county])
);

function normalizeCounty(raw: string | null | undefined): LiberianCounty | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return COUNTY_LOOKUP.get(normalized) ?? null;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function parseMonthStart(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

function parseMonthEnd(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - 1);
}

function assertValidPeriodRange(from: string, to: string) {
  if (!isValidPeriod(from) || !isValidPeriod(to)) {
    throw Object.assign(new Error("from and to must be YYYY-MM format"), { status: 400 });
  }
  if (from > to) {
    throw Object.assign(new Error("from must be <= to"), { status: 400 });
  }
}

function initAccumulator(): CountyAccumulator {
  return {
    masterySum: 0,
    masteryCount: 0,
    growthSum: 0,
    growthCount: 0,
    atRiskCount: 0,
    atRiskTotal: 0,
    attendancePresent: 0,
    attendanceTotal: 0,
  };
}

export async function computeNationalGeoPerformance(params: {
  periodRange: { from: string; to: string };
}): Promise<GeoPerformanceResult> {
  const { from, to } = params.periodRange;
  assertValidPeriodRange(from, to);

  const periodStart = parseMonthStart(from);
  const periodEnd = parseMonthEnd(to);

  const [profiles, attendance] = await Promise.all([
    prisma.studentMasteryProfile.findMany({
      where: { lastAssessedAt: { gte: periodStart, lte: periodEnd } },
      select: {
        currentScore: true,
        baselineScore: true,
        masteryState: true,
        student: {
          select: {
            user: {
              select: {
                school: { select: { county: true } },
              },
            },
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        Meeting: { startsAt: { gte: periodStart, lte: periodEnd } },
      },
      select: {
        status: true,
        Meeting: {
          select: {
            Class: {
              select: {
                School: { select: { county: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const byCounty = new Map<LiberianCounty, CountyAccumulator>();
  for (const county of GEO_COUNTIES) {
    byCounty.set(county, initAccumulator());
  }

  for (const row of profiles) {
    const county = normalizeCounty(row.student.user.school?.county);
    if (!county) continue;
    const entry = byCounty.get(county);
    if (!entry) continue;
    entry.masterySum += row.currentScore;
    entry.masteryCount += 1;
    entry.growthSum += row.currentScore - row.baselineScore;
    entry.growthCount += 1;
    entry.atRiskTotal += 1;
    if (row.masteryState === "DECAYING") entry.atRiskCount += 1;
  }

  for (const row of attendance) {
    const county = normalizeCounty(row.Meeting?.Class?.School?.county);
    if (!county) continue;
    const entry = byCounty.get(county);
    if (!entry) continue;
    entry.attendanceTotal += 1;
    if (row.status === "PRESENT" || row.status === "LATE") {
      entry.attendancePresent += 1;
    }
  }

  const counties = GEO_COUNTIES.map((county) => {
    const acc = byCounty.get(county) ?? initAccumulator();
    const masteryAvg =
      acc.masteryCount > 0 ? round4(acc.masterySum / acc.masteryCount) : null;
    const growthAvg =
      acc.growthCount > 0 ? round4(acc.growthSum / acc.growthCount) : null;
    const atRiskPct =
      acc.atRiskTotal > 0 ? round4(acc.atRiskCount / acc.atRiskTotal) : null;
    const attendanceProxyAvg =
      acc.attendanceTotal > 0
        ? round4(acc.attendancePresent / acc.attendanceTotal)
        : null;

    const hasData =
      masteryAvg !== null ||
      growthAvg !== null ||
      atRiskPct !== null ||
      attendanceProxyAvg !== null;

    return {
      county,
      hasData,
      metrics: {
        masteryAvg,
        growthAvg,
        atRiskPct,
        attendanceProxyAvg,
      },
    };
  });

  return {
    period: {
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
    },
    counties,
  };
}
