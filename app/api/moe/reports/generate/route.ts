import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { requireMoeActor } from "@/lib/moe/authority";
import { generateMOEReport } from "@/lib/reports/moeProgressReport";
import { isCanvaMoeReportsEnabled, isMoePortalEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!isMoePortalEnabled() || typeof isCanvaMoeReportsEnabled !== "function" || !isCanvaMoeReportsEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { user } = await requireMoeActor();
    const [totalSchools, totalStudents, totalLessonsDelivered, schoolsByCounty, subjectRows] = await Promise.all([
      prisma.school.count(),
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.scheduledWork.count({ where: { isDelivered: true } }),
      prisma.school.findMany({
        select: {
          county: true,
          _count: { select: { users: { where: { role: "STUDENT" } }, classes: true } },
        },
      }),
      prisma.scheduledWork.findMany({
        select: {
          isDelivered: true,
          content: { select: { subject: true } },
        },
      }),
    ]);

    const countyMap = new Map<string, { schools: number; activeStudents: number; delivered: number; total: number }>();
    for (const school of schoolsByCounty) {
      const county = school.county?.trim() || "Unassigned";
      const row = countyMap.get(county) ?? { schools: 0, activeStudents: 0, delivered: 0, total: 0 };
      row.schools += 1;
      row.activeStudents += school._count.users ?? 0;
      countyMap.set(county, row);
    }

    const subjectMap = new Map<string, { total: number; delivered: number }>();
    for (const row of subjectRows) {
      const subject = row.content.subject;
      const bucket = subjectMap.get(subject) ?? { total: 0, delivered: 0 };
      bucket.total += 1;
      if (row.isDelivered) bucket.delivered += 1;
      subjectMap.set(subject, bucket);
    }

    const sortedSubjects = Array.from(subjectMap.entries())
      .map(([subject, stats]) => ({
        subject,
        completionRate: stats.total > 0 ? stats.delivered / stats.total : 0,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);

    const generated = await generateMOEReport({
      reportDate: new Date().toISOString().slice(0, 10),
      totalSchools,
      totalStudents,
      totalLessonsDelivered,
      countyBreakdown: Array.from(countyMap.entries()).map(([county, stats]) => ({
        county,
        schools: stats.schools,
        activeStudents: stats.activeStudents,
        completionRate: 0,
      })),
      topSubjects: sortedSubjects.slice(0, 3).map((item) => item.subject),
      weakSubjects: sortedSubjects.slice(-3).map((item) => item.subject),
    });

    await logAudit({
      userId: user.id,
      schoolId: null,
      action: "moe.report.canva.generated",
      resourceType: "moe_report",
      resourceId: "national",
      details: { totalSchools, totalStudents, totalLessonsDelivered },
    });

    return NextResponse.json({ canvaUrl: generated.canvaUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
