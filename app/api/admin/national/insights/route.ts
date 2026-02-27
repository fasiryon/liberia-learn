/**
 * GET /api/admin/national/insights
 *
 * National insights aggregates (county + curriculum).
 * No school, teacher, or student identifiers in the response.
 *
 * Feature flag : ENABLE_NATIONAL_INSIGHTS (default OFF -> 404)
 * Auth         : Platform admin ONLY (requirePlatformAdmin)
 *
 * Params:
 *   from=YYYY-MM  (required) period start
 *   to=YYYY-MM    (required) period end
 *
 * Audit action : "dashboard.insights.national.viewed"
 */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { isNationalInsightsEnabled } from "@/lib/serverFlags";
import { computeNationalGeoPerformance } from "@/lib/reporting/geo/geoAggregator";
import { computeNationalCurriculumSignals } from "@/lib/reporting/curriculum/nationalCurriculumSignals";
import { buildNationalInsights } from "@/lib/reporting/national/nationalInsightsAggregator";
import { isValidPeriod } from "@/lib/metrics/impact/impactEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isNationalInsightsEnabled()) {
      return NextResponse.json({ error: "national_insights_disabled" }, { status: 404 });
    }

    const user = await requirePlatformAdmin();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    if (!isValidPeriod(from) || !isValidPeriod(to)) {
      return NextResponse.json(
        { error: "from and to must be YYYY-MM format" },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
    }

    const [geo, curriculum] = await Promise.all([
      computeNationalGeoPerformance({ periodRange: { from, to } }),
      computeNationalCurriculumSignals(),
    ]);

    const insights = buildNationalInsights({ geo, curriculum });

    await logAudit({
      userId: user.id,
      action: "dashboard.insights.national.viewed",
      resourceType: "national_insights",
      schoolId: null,
      traceId,
      details: {
        from,
        to,
        geoCountiesWithData: insights.sources.geoCountiesWithData,
        curriculumEligibleStrands: insights.sources.curriculumEligibleStrands,
      },
    });

    await recordMetricEvent(
      "national_insights_viewed",
      {
        scope: "national",
        geoCountiesWithData: insights.sources.geoCountiesWithData,
        curriculumEligibleStrands: insights.sources.curriculumEligibleStrands,
      },
      {
        scope: "national",
        scopeId: null,
        schoolId: null,
      }
    );

    return NextResponse.json({
      scope: "national",
      generatedAt: new Date().toISOString(),
      period: geo.period,
      ...insights,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
