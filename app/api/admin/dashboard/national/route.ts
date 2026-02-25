/**
 * GET /api/admin/dashboard/national
 *
 * Returns the national aggregate performance dashboard metrics.
 * No PII — no school names, student names, or identifiers in the response.
 * Aggregates all schools without cross-school identification.
 *
 * Access: Platform Admin only (DASHBOARD_NATIONAL_VIEW — isPlatformAdmin bypass)
 * Feature flag: ENABLE_PERFORMANCE_DASHBOARD — returns 404 when off.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isPerformanceDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeNationalDashboard } from "@/lib/reporting/dashboard/dashboardAggregator";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isPerformanceDashboardEnabled()) {
      return NextResponse.json(
        { error: "performance_dashboard_disabled" },
        { status: 404 }
      );
    }

    const user = await requireRole("ADMIN");
    assertPermission(user, PERMISSIONS.DASHBOARD_NATIONAL_VIEW);

    const metrics = await computeNationalDashboard();

    await logAudit({
      userId: user.id,
      action: "dashboard.view.national",
      resourceType: "dashboard",
      schoolId: null,
      traceId,
      details: { scope: "national" },
    });

    return NextResponse.json({
      scope: "national",
      metrics,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
