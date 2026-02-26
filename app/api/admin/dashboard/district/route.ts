/**
 * GET /api/admin/dashboard/district
 *
 * District-level dashboard aggregation.
 *
 * Feature flag : ENABLE_DISTRICT_INTELLIGENCE (default OFF -> 404)
 * Auth         : ADMIN or DISTRICT_ADMIN + VIEW_DISTRICT_DASHBOARD
 *
 * Audit action : "dashboard.district.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isDistrictIntelligenceEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeDistrictDashboard } from "@/lib/reporting/dashboard/districtAggregator";
import { resolveDistrictContext } from "@/lib/reporting/districtScope";

export const dynamic = "force-dynamic";

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

    const metrics = await computeDistrictDashboard({ tenantId, districtId });

    await logAudit({
      userId: user.id,
      action: "dashboard.district.viewed",
      resourceType: "district_dashboard",
      resourceId: districtId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        districtId,
        schoolCount: metrics.schoolCount,
      },
    });

    return NextResponse.json(metrics);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

