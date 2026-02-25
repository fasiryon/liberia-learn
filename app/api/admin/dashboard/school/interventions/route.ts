/**
 * GET /api/admin/dashboard/school/interventions
 *
 * Class-level intervention alerts for a school.
 * Returns class aggregate signals — no student identifiers.
 * No school ranking — alerts are advisory only.
 *
 * Feature flag : ENABLE_INTERVENTION_ALERTS (default OFF → 404)
 * Auth         : ADMIN role + DASHBOARD_SCHOOL_INTERVENTIONS permission
 *
 * Params:
 *   from=YYYY-MM  (required) period start
 *   to=YYYY-MM    (required) period end
 *   schoolId=<id> (platform admin only; otherwise inferred from session)
 *
 * Audit action : "dashboard.interventions.school.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isInterventionAlertsEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import {
  fetchClassAggregatesForSchool,
  computeInterventionAlerts,
  isValidPeriod,
} from "@/lib/signals/interventions/interventionEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isInterventionAlertsEnabled()) {
      return NextResponse.json({ error: "intervention_alerts_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN");
    assertPermission(user, PERMISSIONS.DASHBOARD_SCHOOL_INTERVENTIONS);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    if (!isValidPeriod(from) || !isValidPeriod(to)) {
      return NextResponse.json(
        { error: "from and to must be YYYY-MM format" },
        { status: 400 }
      );
    }

    const effectiveSchoolId = user.isPlatformAdmin
      ? (searchParams.get("schoolId") ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    if (!effectiveSchoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const classAggregates = await fetchClassAggregatesForSchool(
      effectiveSchoolId,
      { from, to }
    );
    const alerts = computeInterventionAlerts(classAggregates);

    await logAudit({
      userId: user.id,
      action: "dashboard.interventions.school.viewed",
      resourceType: "intervention_alerts",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId,
      traceId,
      details: {
        from,
        to,
        classCount: classAggregates.length,
        alertCount: alerts.length,
      },
    });

    return NextResponse.json({
      alerts,
      classCount: classAggregates.length,
      period: { from, to },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
