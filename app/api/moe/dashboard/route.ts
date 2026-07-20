// app/api/moe/dashboard/route.ts
// Sprint 6 — Enhanced MOE National Dashboard
// Returns platform-wide KPIs + county breakdown + AI usage aggregates.
// No PII — aggregated counts only. Cohorts < 5 students are suppressed.
// 15-minute Redis cache on aggregate payload via Upstash.

import { NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { getProductMetricsDashboard } from "@/lib/reporting/productMetrics";
import { requireMoeActor } from "@/lib/moe/authority";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { withRedisCache } from "@/lib/cache/redisCache";
import { computeNationalGeoPerformance } from "@/lib/reporting/geo/geoAggregator";
import { GEO_COUNTIES } from "@/lib/reporting/geo/counties";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";
import { getMultimediaAnalytics } from "@/lib/analytics/multimediaAnalytics";
import { buildMoeDecisionIntelligence } from "@/lib/analytics/decisionSupport";
import { buildMoeCurriculumIntelligence } from "@/lib/student/adaptiveRecommendations";
import { generateCurriculumFlags, getCurriculumFlagSummary } from "@/lib/intelligence/curriculumFlags";
import { buildMoeOutcomesSummary } from "@/lib/outcomes/examReadiness";

export const dynamic = "force-dynamic";

const MIN_COHORT = 5;
const DASHBOARD_CACHE_TTL_SEC = 900; // 15 minutes

function getDashboardCacheKey(): string {
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `moe:dashboard:national:v3:${month}`;
}

function getDefaultPeriodRange(): { from: string; to: string } {
  const now = new Date();
  const toYear = now.getUTCFullYear();
  const toMonth = now.getUTCMonth() + 1;
  // 3-month window: from 2 months ago through current month
  const fromDate = new Date(Date.UTC(toYear, now.getUTCMonth() - 2, 1));
  return {
    from: `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}`,
    to: `${toYear}-${String(toMonth).padStart(2, "0")}`,
  };
}

function isExamReadinessRouteEnabled() {
  return process.env.ENABLE_EXAM_READINESS?.trim() !== "false";
}

async function getExamStats() {
  const examPrisma = prisma as typeof prisma & {
    exam?: { count: (args?: unknown) => Promise<number> };
    examAttempt?: {
      findMany: (args?: unknown) => Promise<Array<{ passed: boolean; integrityFlags: string[]; exam: { subject: string } }>>;
      count: (args?: unknown) => Promise<number>;
    };
    examCertification?: { count: (args?: unknown) => Promise<number> };
  };

  if (!examPrisma.exam || !examPrisma.examAttempt || !examPrisma.examCertification) {
    return {
      totalExamsPublished: 0,
      examAttempts: [] as Array<{ passed: boolean; integrityFlags: string[]; exam: { subject: string } }>,
      certificationIssued: 0,
      flaggedAttempts: 0,
    };
  }

  const [totalExamsPublished, examAttempts, certificationIssued, flaggedAttempts] = await Promise.all([
    examPrisma.exam.count({ where: { status: "PUBLISHED" } }),
    examPrisma.examAttempt.findMany({
      select: {
        passed: true,
        integrityFlags: true,
        exam: { select: { subject: true } },
      },
    }),
    examPrisma.examCertification.count(),
    examPrisma.examAttempt.count({
      where: { NOT: { integrityFlags: { equals: [] } } },
    }),
  ]);

  return { totalExamsPublished, examAttempts, certificationIssued, flaggedAttempts };
}

async function buildNationalAggregate() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const period = getDefaultPeriodRange();

  const [
    schoolCount,
    districtCount,
    studentCount,
    scheduledWorkTotal,
    scheduledWorkDelivered,
    interventionCount,
    examStats,
    productMetrics,
    geoResult,
    schoolsWithCounty,
    activeStudents,
    nationalMastery,
    aiTotal,
    aiByFeature,
    multimediaAnalytics,
    decisionIntelligence,
    curriculumIntelligence,
    outcomesSummary,
  ] = await Promise.all([
    prisma.school.count().catch(() => 0),
    prisma.district.count().catch(() => 0),
    prisma.student.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.scheduledWork.count().catch(() => 0),
    prisma.scheduledWork.count({ where: { isDelivered: true } }).catch(() => 0),
    prisma.interventionLog.count({ where: { generatedAt: { gte: thirtyDaysAgo } } }).catch(() => 0),
    getExamStats(),
    getProductMetricsDashboard({ period: "30d", schoolId: null }).catch(() => ({ nationalOutcomes: null })),
    computeNationalGeoPerformance({ periodRange: period }).catch(() => ({
      period: { from: period.from, to: period.to },
      counties: [] as Awaited<ReturnType<typeof computeNationalGeoPerformance>>["counties"],
    })),
    // Safe: wraps in Promise.resolve to catch synchronous throws (e.g. undefined mock methods)
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
    // Active this month: students with derived progress in last 30 days
    Promise.resolve()
      .then(() =>
        prisma.derivedStudentProgress.findMany({
          distinct: ["studentId"],
          where: { derivedAt: { gte: thirtyDaysAgo } },
          select: { studentId: true },
        })
      )
      .then((r) => r.length)
      .catch(() => null),
    // National avg mastery score
    Promise.resolve()
      .then(() => prisma.studentMasteryProfile.aggregate({ _avg: { currentScore: true } }))
      .then((r) => r._avg.currentScore)
      .catch(() => null),
    // AI usage last 30 days — total
    Promise.resolve()
      .then(() =>
        prisma.aIInteraction.aggregate({
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
          _sum: { tokensUsed: true, estimatedCostUSD: true },
        })
      )
      .catch(() => null),
    // AI usage last 30 days — by feature
    Promise.resolve()
      .then(() =>
        // Prisma groupBy with having causes a circular type reference in TS; cast bypasses it
        /* eslint-disable-next-line */
        (prisma.aIInteraction as any).groupBy({
          by: ["feature"],
          where: { createdAt: { gte: thirtyDaysAgo }, feature: { not: null } },
          _count: { _all: true },
          _sum: { tokensUsed: true },
          orderBy: { _count: { _all: "desc" } },
          take: 10,
        }) as Promise<{ feature: string | null; _count: { _all: number }; _sum: { tokensUsed: number | null } }[]>
      )
      .catch(() => [] as { feature: string | null; _count: { _all: number }; _sum: { tokensUsed: number | null } }[]),
    getMultimediaAnalytics({ days: 30, schoolId: null }).catch(() => null),
    buildMoeDecisionIntelligence(30).catch(() => null),
    buildMoeCurriculumIntelligence().catch(() => null),
    isExamReadinessRouteEnabled()
      ? buildMoeOutcomesSummary().catch(() => null)
      : Promise.resolve(null),
  ]);

  // Build county student counts (by school county, matching geoAggregator logic)
  const countyStudentMap = new Map<string, number>();
  for (const s of schoolsWithCounty) {
    if (!s.county) continue;
    const county = GEO_COUNTIES.find((label) => label.toLowerCase() === s.county?.trim().toLowerCase());
    if (!county) continue;
    countyStudentMap.set(county, (countyStudentMap.get(county) ?? 0) + (s._count?.users ?? 0));
  }

  const geoCounties =
    geoResult.counties.length > 0
      ? geoResult.counties
      : countyStudentMap.size > 0
        ? GEO_COUNTIES.map((county) => ({
            county,
            hasData: false,
            metrics: {
              masteryAvg: null,
              growthAvg: null,
              atRiskPct: null,
              attendanceProxyAvg: null,
            },
          }))
        : [];

  // Apply cohort suppression: counties with < MIN_COHORT students get suppressed metrics.
  // If the performance aggregate is unavailable but schools still carry county labels,
  // preserve those real labels and suppress metrics instead of returning an empty county list.
  const countyBreakdown = geoCounties.map((c) => {
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

  const deliveryRate =
    scheduledWorkTotal > 0
      ? Math.round((scheduledWorkDelivered / scheduledWorkTotal) * 10000) / 100
      : null;

  const subjectBuckets = new Map<string, { attempts: number; passed: number }>();
  for (const attempt of examStats.examAttempts) {
    const bucket = subjectBuckets.get(attempt.exam.subject) ?? { attempts: 0, passed: 0 };
    bucket.attempts += 1;
    if (attempt.passed) bucket.passed += 1;
    subjectBuckets.set(attempt.exam.subject, bucket);
  }

  const totalInteractions = aiTotal?._count._all ?? 0;
  const totalTokens = aiTotal?._sum.tokensUsed ?? 0;
  const totalCostUSD = aiTotal?._sum.estimatedCostUSD ?? 0;
  const safeAiByFeature = Array.isArray(aiByFeature) ? aiByFeature : [];

  return {
    generatedAt: new Date().toISOString(),
    geoPeriod: period,
    // Core KPIs
    schools: schoolCount,
    districts: districtCount,
    students: studentCount,
    activeStudentsLast30Days: activeStudents,
    nationalAvgMasteryScore:
      nationalMastery != null ? Math.round(nationalMastery * 100) / 100 : null,
    // Delivery
    scheduledWork: {
      total: scheduledWorkTotal,
      delivered: scheduledWorkDelivered,
      deliveryRatePct: deliveryRate,
    },
    interventionsLast30Days: interventionCount,
    // Exams & certifications
    examStats: {
      totalExamsPublished: examStats.totalExamsPublished,
      totalAttempts: examStats.examAttempts.length,
      nationalPassRate:
        examStats.examAttempts.length > 0
          ? Math.round(
              (examStats.examAttempts.filter((a) => a.passed).length /
                examStats.examAttempts.length) *
                10000
            ) / 100
          : 0,
      certificationIssued: examStats.certificationIssued,
      flaggedAttempts: examStats.flaggedAttempts,
      subjectBreakdown: Array.from(subjectBuckets.entries()).map(([subject, b]) => ({
        subject,
        attempts: b.attempts,
        passRate: b.attempts > 0 ? Math.round((b.passed / b.attempts) * 10000) / 100 : 0,
      })),
    },
    // Product metrics
    productMetrics: {
      nationalLessonCompletionRate:
        productMetrics.nationalOutcomes?.nationalLessonCompletionRate ?? 0,
      nationalExamPassRate: productMetrics.nationalOutcomes?.nationalExamPassRate ?? 0,
      nationalGuardianEngagementRate:
        productMetrics.nationalOutcomes?.nationalGuardianEngagementRate ?? 0,
      interventionImpactRate: productMetrics.nationalOutcomes?.interventionImpactRate ?? 0,
      topPerformingDistricts: productMetrics.nationalOutcomes?.topPerformingDistricts ?? [],
      lowestPerformingDistricts:
        productMetrics.nationalOutcomes?.lowestPerformingDistricts ?? [],
    },
    // Sprint 6: county breakdown (all 15 Liberian counties)
    countyBreakdown,
    // Sprint 6: AI usage aggregates (Sprint 4 AIInteraction data)
    aiUsageLast30Days: {
      totalInteractions,
      totalTokensUsed: totalTokens,
      estimatedCostUSD: totalCostUSD != null ? Math.round(totalCostUSD * 100) / 100 : null,
      avgCostPerInteraction:
        totalInteractions > 0 && totalCostUSD != null
          ? Math.round((totalCostUSD / totalInteractions) * 10000) / 10000
          : null,
      byFeature: safeAiByFeature.map((row) => ({
        feature: row.feature,
        interactions: row._count._all,
        tokensUsed: row._sum.tokensUsed ?? 0,
      })),
    },
    multimediaAnalytics,
    decisionIntelligence,
    curriculumIntelligence,
    outcomesSummary,
  };
}

async function dashboardGET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const { user } = await requireMoeActor();

    const aggregate = await withRedisCache(
      getDashboardCacheKey(),
      DASHBOARD_CACHE_TTL_SEC,
      buildNationalAggregate
    );

    // Fire-and-forget: audit + learning event (always per-request, not cached)
    void logAudit({ userId: user.id, action: "MOE_DASHBOARD_VIEW", resourceType: "national_dashboard" });
    void logDataAccess({
      userId: user.id,
      schoolId: null,
      resourceType: "moe_dashboard",
      resourceId: "national",
      action: "view",
      scope: "national",
    });
    logLearningEvent({
      userId: user.id,
      eventType: "moe.dashboard.viewed",
      metadata: { scope: "national" },
    }).catch(() => {});

    // Curriculum flags — live, not cached (generated from curriculum intelligence)
    const ci = (aggregate as any).curriculumIntelligence;
    if (ci) {
      generateCurriculumFlags(
        ci.weakLessons ?? [],
        ci.conceptGaps ?? [],
        null
      ).catch(() => null);
    }
    const curriculumFlagSummary = await getCurriculumFlagSummary(null).catch(() => null);

    return NextResponse.json({ ...aggregate, curriculumFlagSummary });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export const GET = withRequestLogging("/api/moe/dashboard", dashboardGET);
