/**
 * GET /api/admin/dashboard/school
 *
 * Returns the school-level performance dashboard metrics.
 * Tenant-isolated: non-platform-admins always see only their own school.
 *
 * Query params:
 *   schoolId — platform admin only: view a specific school's dashboard
 *
 * Access: ADMIN (own school) | Platform Admin (any school)
 * Feature flag: ENABLE_PERFORMANCE_DASHBOARD — returns 404 when off.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isPerformanceDashboardEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeSchoolDashboard } from "@/lib/reporting/dashboard/dashboardAggregator";
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
    assertPermission(user, PERMISSIONS.DASHBOARD_SCHOOL_VIEW);

    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get("schoolId");

    // Tenant isolation: non-platform admins cannot access other schools
    if (!user.isPlatformAdmin && requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId =
      user.isPlatformAdmin && requestedSchoolId
        ? requestedSchoolId
        : user.schoolId ?? null;

    if (!schoolId) {
      return NextResponse.json({ error: "no_school_context" }, { status: 400 });
    }

    const metrics = await computeSchoolDashboard(schoolId);

    await logAudit({
      userId: user.id,
      action: "dashboard.view.school",
      resourceType: "dashboard",
      schoolId,
      traceId,
      details: { scope: "school", schoolId },
    });

    return NextResponse.json({
      scope: "school",
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
