/**
 * GET /api/admin/dashboard/district/trends
 *
 * District-level trend aggregation.
 *
 * Feature flag : ENABLE_DISTRICT_INTELLIGENCE (default OFF -> 404)
 * Auth         : ADMIN or DISTRICT_ADMIN + VIEW_DISTRICT_DASHBOARD
 *
 * Audit action : "dashboard.district.trends.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isDistrictIntelligenceEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeDistrictTrends } from "@/lib/reporting/trends/districtTrendAggregator";
import { resolveDistrictContext } from "@/lib/reporting/districtScope";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | null): "monthly" | "quarterly" {
  if (!raw || raw === "monthly") return "monthly";
  if (raw === "quarterly") return "quarterly";
  throw Object.assign(new Error("Invalid period"), { status: 400 });
}

function parseLookback(raw: string | null): number {
  if (!raw) return 6;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error("Invalid lookback"), { status: 400 });
  }
  return value;
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isDistrictIntelligenceEnabled()) {
      return NextResponse.json({ error: "district_intelligence_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "DISTRICT_ADMIN");
    assertPermission(user, PERMISSIONS.VIEW_DISTRICT_DASHBOARD);

    const { searchParams } = new URL(req.url);
    const { districtId, tenantId } = await resolveDistrictContext({ user, searchParams });

    const period = parsePeriod(searchParams.get("period"));
    const lookbackMonths = parseLookback(searchParams.get("lookback"));

    const trends = await computeDistrictTrends({
      tenantId,
      districtId,
      period,
      lookbackMonths,
    });

    await logAudit({
      userId: user.id,
      action: "dashboard.district.trends.viewed",
      resourceType: "district_trends",
      resourceId: districtId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        districtId,
        period,
        lookbackMonths,
      },
    });

    return NextResponse.json(trends);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

