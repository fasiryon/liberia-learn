// app/api/moe/dashboard/route.ts
// Block 28 — MOE National Dashboard
// Returns platform-wide summary counts for Ministry of Education officials.
// No PII — aggregated counts only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export const dynamic = "force-dynamic";

async function dashboardGET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      schoolCount,
      districtCount,
      studentCount,
      scheduledWorkTotal,
      scheduledWorkDelivered,
      interventionCount,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.district.count(),
      prisma.student.count(),
      prisma.scheduledWork.count(),
      prisma.scheduledWork.count({ where: { isDelivered: true } }),
      prisma.interventionLog.count({
        where: { generatedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const deliveryRate =
      scheduledWorkTotal > 0
        ? Math.round((scheduledWorkDelivered / scheduledWorkTotal) * 10000) / 100
        : null;

    void logAudit({
      userId: user.id,
      action: "MOE_DASHBOARD_VIEW",
      resourceType: "national_dashboard",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      schools: schoolCount,
      districts: districtCount,
      students: studentCount,
      scheduledWork: {
        total: scheduledWorkTotal,
        delivered: scheduledWorkDelivered,
        deliveryRatePct: deliveryRate,
      },
      interventionsLast30Days: interventionCount,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export const GET = withRequestLogging("/api/moe/dashboard", dashboardGET);
