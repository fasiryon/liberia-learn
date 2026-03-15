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

async function getExamStats() {
  const examPrisma = prisma as typeof prisma & {
    exam?: { count: (args?: unknown) => Promise<number> };
    examAttempt?: {
      findMany: (args?: unknown) => Promise<Array<{ passed: boolean; integrityFlags: string[]; exam: { subject: string } }>>;
      count: (args?: unknown) => Promise<number>;
    };
    examCertification?: { count: (args?: unknown) => Promise<number> };
  };

  if (!examPrisma.exam || !examPrisma.examAttempt || !examPrisma.examCertification) {
    return {
      totalExamsPublished: 0,
      examAttempts: [] as Array<{ passed: boolean; integrityFlags: string[]; exam: { subject: string } }>,
      certificationIssued: 0,
      flaggedAttempts: 0,
    };
  }

  const [totalExamsPublished, examAttempts, certificationIssued, flaggedAttempts] = await Promise.all([
    examPrisma.exam.count({ where: { status: "PUBLISHED" } }),
    examPrisma.examAttempt.findMany({
      select: {
        passed: true,
        integrityFlags: true,
        exam: { select: { subject: true } },
      },
    }),
    examPrisma.examCertification.count(),
    examPrisma.examAttempt.count({
      where: { NOT: { integrityFlags: { equals: [] } } },
    }),
  ]);

  return {
    totalExamsPublished,
    examAttempts,
    certificationIssued,
    flaggedAttempts,
  };
}

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
      examStats,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.district.count(),
      prisma.student.count(),
      prisma.scheduledWork.count(),
      prisma.scheduledWork.count({ where: { isDelivered: true } }),
      prisma.interventionLog.count({
        where: { generatedAt: { gte: thirtyDaysAgo } },
      }),
      getExamStats(),
    ]);

    const deliveryRate =
      scheduledWorkTotal > 0
        ? Math.round((scheduledWorkDelivered / scheduledWorkTotal) * 10000) / 100
        : null;

    const subjectBuckets = new Map<string, { attempts: number; passed: number }>();
    for (const attempt of examStats.examAttempts) {
      const bucket = subjectBuckets.get(attempt.exam.subject) ?? { attempts: 0, passed: 0 };
      bucket.attempts += 1;
      if (attempt.passed) bucket.passed += 1;
      subjectBuckets.set(attempt.exam.subject, bucket);
    }

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
      examStats: {
        totalExamsPublished: examStats.totalExamsPublished,
        totalAttempts: examStats.examAttempts.length,
        nationalPassRate:
          examStats.examAttempts.length > 0
            ? Math.round((examStats.examAttempts.filter((attempt) => attempt.passed).length / examStats.examAttempts.length) * 10000) /
              100
            : 0,
        certificationIssued: examStats.certificationIssued,
        flaggedAttempts: examStats.flaggedAttempts,
        subjectBreakdown: Array.from(subjectBuckets.entries()).map(([subject, bucket]) => ({
          subject,
          attempts: bucket.attempts,
          passRate: bucket.attempts > 0 ? Math.round((bucket.passed / bucket.attempts) * 10000) / 100 : 0,
        })),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export const GET = withRequestLogging("/api/moe/dashboard", dashboardGET);
