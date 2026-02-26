import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isLongitudinalTrackingEnabled } from "@/lib/serverFlags";
import { computeSchoolGrowthSummary } from "@/lib/reporting/growth/growthAggregator";
import { startOfMonthUtc } from "@/lib/metrics/longitudinal/growthRepo";

export const dynamic = "force-dynamic";

function parsePeriodStart(value: string | null): Date {
  if (!value) return startOfMonthUtc(new Date());
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw Object.assign(new Error("periodStart must be YYYY-MM"), { status: 400 });
  }
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isLongitudinalTrackingEnabled()) {
      return NextResponse.json({ error: "longitudinal_tracking_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "DISTRICT_ADMIN");
    assertPermission(user, PERMISSIONS.VIEW_SCHOOL_DASHBOARD);

    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const periodStart = parsePeriodStart(searchParams.get("periodStart"));

    if (!user.isPlatformAdmin && requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveSchoolId = user.isPlatformAdmin
      ? (requestedSchoolId ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    if (!effectiveSchoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const summary = await computeSchoolGrowthSummary({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
      periodStart,
    });

    await logAudit({
      userId: user.id,
      action: "dashboard.growth.school_summary.viewed",
      resourceType: "longitudinal_growth",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        periodStart: periodStart.toISOString(),
        sampleSize: summary.sampleSize,
      },
    });

    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
