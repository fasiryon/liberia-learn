// app/api/moe/counties/route.ts — Sprint 6
// All 15 Liberian counties with performance metrics.
// No PII — aggregated, cohorts < 5 suppressed.
// 15-minute Redis cache.

import { NextRequest, NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { requireMoeActor } from "@/lib/moe/authority";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { withRedisCache } from "@/lib/cache/redisCache";
import { computeNationalGeoPerformance } from "@/lib/reporting/geo/geoAggregator";
import { buildNationalInsights } from "@/lib/reporting/national/nationalInsightsAggregator";
import { computeNationalCurriculumSignals } from "@/lib/reporting/curriculum/nationalCurriculumSignals";

export const dynamic = "force-dynamic";

const MIN_COHORT = 5;
const CACHE_TTL_SEC = 900;

function parsePeriod(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}$/.test(value) ? value : null;
}

function getDefaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const to = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const from = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return { from, to };
}

async function buildCountyPayload(from: string, to: string) {
  const [geoResult, schoolsWithCounty, curriculum] = await Promise.all([
    computeNationalGeoPerformance({ periodRange: { from, to } }).catch(() => ({
      period: { from, to },
      counties: [] as Awaited<ReturnType<typeof computeNationalGeoPerformance>>["counties"],
    })),
    Promise.resolve()
      .then(() =>
        prisma.school.findMany({
          select: {
            county: true,
            _count: { select: { users: { where: { role: "STUDENT" } } } },
          },
        })
      )
      .catch(() => [] as { county: string | null; _count: { users: number } }[]),
    computeNationalCurriculumSignals({}).catch(() => ({
      rows: [],
      weakByGradeBand: {},
      summary: {
        totalProfilesConsidered: 0,
        eligibleStrandCount: 0,
        filteredOutBySample: 0,
        minSampleSize: 0,
        weakBottomN: 0,
        weakMasteryThreshold: 0,
      },
    })),
  ]);

  const countyStudentMap = new Map<string, number>();
  for (const s of schoolsWithCounty) {
    if (!s.county) continue;
    countyStudentMap.set(s.county, (countyStudentMap.get(s.county) ?? 0) + s._count.users);
  }

  const counties = geoResult.counties.map((c) => {
    const countyStudents = countyStudentMap.get(c.county) ?? 0;
    const suppressed = !c.hasData || countyStudents < MIN_COHORT;
    return {
      county: c.county,
      hasData: c.hasData && !suppressed,
      suppressed,
      studentCount: suppressed ? null : countyStudents,
      metrics: suppressed ? null : c.metrics,
    };
  });

  const insights = buildNationalInsights({ geo: geoResult, curriculum });

  return {
    generatedAt: new Date().toISOString(),
    period: { from, to },
    totalCounties: counties.length,
    countiesWithData: counties.filter((c) => c.hasData).length,
    counties,
    insights: {
      topImproving: insights.topImprovingCounties,
      topDeclining: insights.topDecliningCounties,
      cards: insights.insights,
      benchmarks: insights.benchmarks,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const { user } = await requireMoeActor();

    const rawFrom = req.nextUrl.searchParams.get("from");
    const rawTo = req.nextUrl.searchParams.get("to");
    const defaultPeriod = getDefaultPeriod();
    const from = parsePeriod(rawFrom) ?? defaultPeriod.from;
    const to = parsePeriod(rawTo) ?? defaultPeriod.to;

    if (from > to) {
      return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
    }

    const cacheKey = `moe:counties:v1:${from}:${to}`;
    const payload = await withRedisCache(cacheKey, CACHE_TTL_SEC, () =>
      buildCountyPayload(from, to)
    );

    void logAudit({ userId: user.id, action: "MOE_COUNTY_BREAKDOWN_VIEW", resourceType: "county_breakdown" });

    return NextResponse.json(payload);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
