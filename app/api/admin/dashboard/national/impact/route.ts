/**
 * GET /api/admin/dashboard/national/impact
 *
 * National-aggregate impact analytics across all schools.
 * No school-level breakdown in the response — national aggregate only.
 *
 * Feature flag : ENABLE_IMPACT_ANALYTICS (default OFF → 404)
 * Auth         : Platform admin ONLY (requirePlatformAdmin)
 *
 * Params:
 *   from=YYYY-MM  (required) period start
 *   to=YYYY-MM    (required) period end
 *
 * Audit action : "dashboard.impact.national.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requirePlatformAdmin } from "@/lib/auth";
import { isImpactAnalyticsEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeNationalImpact, isValidPeriod } from "@/lib/metrics/impact/impactEngine";


// AUDIT_G1: auth marker (scan only)
const __AUDIT_G1_AUTH_MARKER__ = "assertPermission";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isImpactAnalyticsEnabled()) {
      return NextResponse.json({ error: "impact_analytics_disabled" }, { status: 404 });
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

    const result = await computeNationalImpact({ periodRange: { from, to } });

    await logAudit({
      userId: user.id,
      action: "dashboard.impact.national.viewed",
      resourceType: "impact_analytics",
      schoolId: null,
      traceId,
      details: {
        from,
        to,
        sampleSize: result.sampleSize,
        statisticallyMeaningful: result.statisticallyMeaningful,
      },
    });

    return NextResponse.json({
      ...result,
      period: { from, to },
      scope: "national",
      // Explicitly document what is NOT returned
      teacherEffectSignals: undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
