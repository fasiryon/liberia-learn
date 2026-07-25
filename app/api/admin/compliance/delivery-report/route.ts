import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDeliveryComplianceReportingEnabled } from "@/lib/serverFlags";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { readMoeAlignmentCodes } from "@/lib/moe/alignmentReader";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/compliance/delivery-report?schoolId=&weekOf=
 * Part 8: MOE delivery compliance aggregate report. No student identifiers.
 */
async function deliveryReportGET(req: NextRequest) {
  if (!isDeliveryComplianceReportingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const schoolIdParam = searchParams.get("schoolId");
    const weekOfParam = searchParams.get("weekOf");

    // Tenant isolation: non-platform-admin can only report on their own school
    let schoolId: string;
    if (user.isPlatformAdmin) {
      if (!schoolIdParam) {
        return NextResponse.json({ error: "schoolId required" }, { status: 400 });
      }
      schoolId = schoolIdParam;
    } else {
      if (!user.schoolId) {
        return NextResponse.json({ error: "No school context" }, { status: 400 });
      }
      if (schoolIdParam && schoolIdParam !== user.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      schoolId = user.schoolId;
    }

    // Resolve week range
    const baseDate = weekOfParam ? new Date(weekOfParam) : new Date();
    const day = baseDate.getUTCDay();
    const monday = new Date(baseDate);
    monday.setUTCDate(baseDate.getUTCDate() - ((day + 6) % 7));
    monday.setUTCHours(0, 0, 0, 0);
    const friday = new Date(monday);
    friday.setUTCDate(monday.getUTCDate() + 5);

    // Get all classes for this school
    const classes = await prisma.class.findMany({
      where: { schoolId },
      select: { id: true },
    });
    const classIds = classes.map((c) => c.id);

    if (classIds.length === 0) {
      return NextResponse.json({
        plannedLessons: 0,
        deliveredLessons: 0,
        deliveryRate: 0,
        moeStandardsCovered: [],
        labSessionsCompleted: 0,
        assignmentsLinked: 0,
      });
    }

    const schedule = await prisma.scheduledWork.findMany({
      where: {
        classId: { in: classIds },
        scheduledDate: { gte: monday, lt: friday },
      },
      include: {
        content: { select: { moeAlignments: true } },
      },
    });

    const plannedLessons = schedule.length;
    const deliveredLessons = schedule.filter((sw) => sw.isDelivered).length;
    const deliveryRate = plannedLessons > 0 ? deliveredLessons / plannedLessons : 0;

    // Unique MOE codes covered in delivered lessons
    const coveredCodes = new Set<string>();
    for (const sw of schedule.filter((s) => s.isDelivered)) {
      for (const code of readMoeAlignmentCodes(sw.content.moeAlignments)) coveredCodes.add(code);
    }

    const scheduleIds = schedule.map((sw) => sw.id);

    const labSessionsCompleted =
      scheduleIds.length > 0
        ? await prisma.labSession.count({
            where: {
              scheduledWorkId: { in: scheduleIds },
              schoolId,
              completedAt: { not: null },
            },
          })
        : 0;

    const assignmentsLinked =
      scheduleIds.length > 0
        ? await prisma.assignment.count({
            where: {
              scheduledWorkId: { in: scheduleIds },
            },
          })
        : 0;

    return NextResponse.json({
      plannedLessons,
      deliveredLessons,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      moeStandardsCovered: Array.from(coveredCodes),
      labSessionsCompleted,
      assignmentsLinked,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export const GET = withRequestLogging(
  "/api/admin/compliance/delivery-report",
  deliveryReportGET
);
