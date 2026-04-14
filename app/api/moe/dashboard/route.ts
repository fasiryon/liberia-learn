import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { getProductMetricsDashboard } from "@/lib/reporting/productMetrics";
import { isMoeDistrictRole, isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

function getDashboardPrisma() {
  const unsafe = prisma as typeof prisma & {
    class?: {
      findMany?: (args: unknown) => Promise<Array<{ id: string }>>;
    };
    exam?: {
      count?: (args: unknown) => Promise<number>;
    };
    examAttempt?: {
      findMany?: (args: unknown) => Promise<Array<{ passed: boolean; integrityFlags: string[]; exam: { subject: string } }>>;
      count?: (args: unknown) => Promise<number>;
    };
    examCertification?: {
      count?: (args: unknown) => Promise<number>;
    };
  };

  return {
    class: unsafe.class,
    exam: unsafe.exam,
    examAttempt: unsafe.examAttempt,
    examCertification: unsafe.examCertification,
  };
}

async function resolveScope(user: Awaited<ReturnType<typeof requireUser>>) {
  const isNational = user.isPlatformAdmin || isMoeSuperRole(user.role);
  if (isNational) {
    return { level: "national" as const, districtId: null, districtName: null, schoolIds: null };
  }

  if (!isMoeDistrictRole(user.role) || !user.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { districtId: true, District: { select: { name: true } } },
  });
  const districtId = school?.districtId ?? null;
  if (!districtId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const schoolIds = (
    await prisma.school.findMany({
      where: { districtId },
      select: { id: true },
    })
  ).map((item) => item.id);

  return {
    level: "district" as const,
    districtId,
    districtName: school?.District?.name ?? null,
    schoolIds,
  };
}

async function dashboardGET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const scope = await resolveScope(user);
    const schoolIds = scope.schoolIds;
    const delegates = getDashboardPrisma();
    const classIds = delegates.class?.findMany
      ? (
          await delegates.class.findMany({
            where: schoolIds ? { schoolId: { in: schoolIds } } : {},
            select: { id: true },
          })
        ).map((item) => item.id)
      : [];

    const scheduledWorkWhere = schoolIds ? { classId: { in: classIds.length > 0 ? classIds : ["__none__"] } } : {};
    const examWhere = schoolIds ? { schoolId: { in: schoolIds } } : {};

    const [
      schoolCount,
      districtCount,
      studentCount,
      scheduledWorkTotal,
      scheduledWorkDelivered,
      interventionCount,
      totalExamsPublished,
      examAttempts,
      certificationIssued,
      flaggedAttempts,
      productMetrics,
    ] = await Promise.all([
      prisma.school.count({ where: schoolIds ? { id: { in: schoolIds } } : {} }),
      prisma.district.count({ where: scope.districtId ? { id: scope.districtId } : {} }),
      prisma.student.count({ where: schoolIds ? { user: { schoolId: { in: schoolIds } } } : {} }),
      prisma.scheduledWork.count({ where: scheduledWorkWhere }),
      prisma.scheduledWork.count({ where: { ...scheduledWorkWhere, isDelivered: true } }),
      prisma.interventionLog.count({ where: scope.districtId ? { districtId: scope.districtId } : {} }),
      delegates.exam?.count
        ? delegates.exam.count({ where: { ...examWhere, status: "PUBLISHED" } })
        : Promise.resolve(0),
      delegates.examAttempt?.findMany
        ? delegates.examAttempt.findMany({
            where: schoolIds ? { exam: { schoolId: { in: schoolIds } } } : {},
            select: {
              passed: true,
              integrityFlags: true,
              exam: { select: { subject: true } },
            },
          })
        : Promise.resolve([]),
      delegates.examCertification?.count
        ? delegates.examCertification.count({ where: schoolIds ? { exam: { schoolId: { in: schoolIds } } } : {} })
        : Promise.resolve(0),
      delegates.examAttempt?.count
        ? delegates.examAttempt.count({
            where: {
              ...(schoolIds ? { exam: { schoolId: { in: schoolIds } } } : {}),
              NOT: { integrityFlags: { equals: [] } },
            },
          })
        : Promise.resolve(0),
      scope.level === "national"
        ? getProductMetricsDashboard({ period: "30d", schoolId: null }).catch(() => null)
        : null,
    ]);

    const subjectBuckets = new Map<string, { attempts: number; passed: number }>();
    for (const attempt of examAttempts) {
      const bucket = subjectBuckets.get(attempt.exam.subject) ?? { attempts: 0, passed: 0 };
      bucket.attempts += 1;
      if (attempt.passed) bucket.passed += 1;
      subjectBuckets.set(attempt.exam.subject, bucket);
    }

    await logAudit({
      userId: user.id,
      action: "MOE_DASHBOARD_VIEW",
      resourceType: "national_dashboard",
      details: {
        scope: scope.level,
        districtId: scope.districtId,
      },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      scope,
      schools: schoolCount,
      districts: districtCount,
      students: studentCount,
      scheduledWork: {
        total: scheduledWorkTotal,
        delivered: scheduledWorkDelivered,
        deliveryRatePct:
          scheduledWorkTotal > 0 ? Math.round((scheduledWorkDelivered / scheduledWorkTotal) * 10000) / 100 : null,
      },
      interventionsLast30Days: interventionCount,
      examStats: {
        totalExamsPublished,
        totalAttempts: examAttempts.length,
        nationalPassRate:
          examAttempts.length > 0
            ? Math.round((examAttempts.filter((attempt) => attempt.passed).length / examAttempts.length) * 10000) / 100
            : 0,
        certificationIssued,
        flaggedAttempts,
        subjectBreakdown: Array.from(subjectBuckets.entries()).map(([subject, bucket]) => ({
          subject,
          attempts: bucket.attempts,
          passRate: bucket.attempts > 0 ? Math.round((bucket.passed / bucket.attempts) * 10000) / 100 : 0,
        })),
      },
      productMetrics: scope.level === "national"
        ? {
            nationalLessonCompletionRate: productMetrics?.nationalOutcomes?.nationalLessonCompletionRate ?? 0,
            nationalExamPassRate: productMetrics?.nationalOutcomes?.nationalExamPassRate ?? 0,
            nationalGuardianEngagementRate: productMetrics?.nationalOutcomes?.nationalGuardianEngagementRate ?? 0,
            interventionImpactRate: productMetrics?.nationalOutcomes?.interventionImpactRate ?? 0,
            topPerformingDistricts: productMetrics?.nationalOutcomes?.topPerformingDistricts ?? [],
            lowestPerformingDistricts: productMetrics?.nationalOutcomes?.lowestPerformingDistricts ?? [],
          }
        : {
            nationalLessonCompletionRate: 0,
            nationalExamPassRate: 0,
            nationalGuardianEngagementRate: 0,
            interventionImpactRate: 0,
            topPerformingDistricts: [],
            lowestPerformingDistricts: [],
          },
    });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/dashboard", method: "GET" });
  }
}

export const GET = withRequestLogging("/api/moe/dashboard", dashboardGET);
