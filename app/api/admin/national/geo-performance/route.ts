/**
 * GET /api/admin/national/geo-performance
 *
 * National geo-performance aggregates by county (no school breakdowns).
 *
 * Feature flag : ENABLE_GEO_INTELLIGENCE (default OFF -> 404)
 * Auth         : Platform admin ONLY (requirePlatformAdmin)
 *
 * Params:
 *   from=YYYY-MM  (required) period start
 *   to=YYYY-MM    (required) period end
 *
 * Audit action : "dashboard.geo.national.viewed"
 */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { isGeoIntelligenceEnabled } from "@/lib/serverFlags";
import { computeNationalGeoPerformance } from "@/lib/reporting/geo/geoAggregator";
import { isValidPeriod } from "@/lib/metrics/impact/impactEngine";

export const dynamic = "force-dynamic";

const GEO_NOTES = {
  privacy:
    "County-level aggregates only. No school, teacher, or student identifiers are returned.",
  methodology:
    "masteryAvg and growthAvg are derived from StudentMasteryProfile for the period; atRiskPct is the share of profiles in DECAYING masteryState; attendanceProxyAvg is PRESENT+LATE divided by total attendance records within the period.",
};

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isGeoIntelligenceEnabled()) {
      return NextResponse.json({ error: "geo_intelligence_disabled" }, { status: 404 });
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

    const result = await computeNationalGeoPerformance({ periodRange: { from, to } });

    await logAudit({
      userId: user.id,
      action: "dashboard.geo.national.viewed",
      resourceType: "geo_performance",
      schoolId: null,
      traceId,
      details: {
        from,
        to,
        countiesWithData: result.counties.filter((c) => c.hasData).length,
      },
    });

    await recordMetricEvent(
      "geo_performance_viewed",
      {
        scope: "national",
        countiesWithData: result.counties.filter((c) => c.hasData).length,
      },
      {
        scope: "national",
        scopeId: null,
        schoolId: null,
      }
    );

    return NextResponse.json({
      period: result.period,
      counties: result.counties,
      notes: GEO_NOTES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
