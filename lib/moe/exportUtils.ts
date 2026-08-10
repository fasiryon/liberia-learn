import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type SchoolExportMetrics = {
  schoolId: string;
  schoolName: string;
  county: string;
  district: string;
  totalStudents: number;
  activeStudents: number;
  avgLessonCompletionPct: number;
  avgExamScore: number;
  placementTestsCompleted: number;
  interventionRatePct: number;
  guardianEngagementPct: number;
};

/// Minimum cohort size before per-student export rows are suppressed in
/// favor of an aggregate-only summary, to prevent re-identification of
/// individual minors in small schools/classes.
export const MIN_COHORT_SIZE = 5;

function csvEscape(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number>>) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

export function formatExportDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function anonymizeStudentId(studentId: string, schoolId: string) {
  return createHash("sha256")
    .update(`${schoolId}:${studentId}`, "utf8")
    .digest("hex")
    .slice(0, 12);
}

export async function requireMoeExportUser() {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();
  if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}

export async function logStudentCohortExport(params: {
  userId: string;
  schoolId: string;
}) {
  await logAudit({
    userId: params.userId,
    action: "moe.export.student-cohort",
    resourceType: "school",
    resourceId: params.schoolId,
  });
}

export async function getSchoolExportMetrics(district?: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const schools = await prisma.school.findMany({
    where: district ? { district: district } : undefined,
    select: {
      id: true,
      name: true,
      county: true,
      district: true,
      District: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const metrics = await Promise.all(
    schools.map(async (school) => {
      const [
        totalStudents,
        activeProgressRows,
        completedProgressRows,
        allProgressRows,
        examAttempts,
        placementTestsCompleted,
        interventionCount,
        linkedGuardians,
      ] = await Promise.all([
        prisma.student.count({
          where: { user: { schoolId: school.id } },
        }),
        prisma.auditLog.findMany({
          where: {
            action: "lesson_view",
            createdAt: { gte: thirtyDaysAgo },
            user: {
              role: "STUDENT",
              schoolId: school.id,
            },
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.studentProgress.count({
          where: {
            completedAt: { not: null },
            scheduledWork: { class: { schoolId: school.id } },
          },
        }),
        prisma.studentProgress.count({
          where: {
            scheduledWork: { class: { schoolId: school.id } },
          },
        }),
        prisma.examAttempt.findMany({
          where: {
            student: { user: { schoolId: school.id } },
            submittedAt: { not: null },
          },
          select: { score: true },
        }),
        prisma.placementTest.count({
          where: { student: { user: { schoolId: school.id } } },
        }),
        prisma.interventionRecommendation.count({
          where: { schoolId: school.id },
        }),
        prisma.studentGuardian.findMany({
          where: { student: { user: { schoolId: school.id } } },
          select: { studentId: true },
          distinct: ["studentId"],
        }),
      ]);

      const avgLessonCompletionPct =
        allProgressRows > 0
          ? Math.round((completedProgressRows / allProgressRows) * 10000) / 100
          : 0;
      const avgExamScore =
        examAttempts.length > 0
          ? Math.round(
              (examAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
                examAttempts.length) *
                10000
            ) / 100
          : 0;
      const interventionRatePct =
        totalStudents > 0
          ? Math.round((interventionCount / totalStudents) * 10000) / 100
          : 0;
      const guardianEngagementPct =
        totalStudents > 0
          ? Math.round((linkedGuardians.length / totalStudents) * 10000) / 100
          : 0;

      return {
        schoolId: school.id,
        schoolName: school.name,
        county: school.county ?? "Unassigned",
        district: school.District?.name ?? school.district ?? "Unassigned",
        totalStudents,
        activeStudents: activeProgressRows.length,
        avgLessonCompletionPct,
        avgExamScore,
        placementTestsCompleted,
        interventionRatePct,
        guardianEngagementPct,
      } satisfies SchoolExportMetrics;
    })
  );

  return metrics;
}

export function schoolMetricsToCsvRows(metrics: SchoolExportMetrics[], exportDate: string) {
  return metrics.map((row) => [
    row.schoolName,
    row.county,
    row.district,
    row.totalStudents,
    row.activeStudents,
    row.avgLessonCompletionPct,
    row.avgExamScore,
    row.placementTestsCompleted,
    row.interventionRatePct,
    row.guardianEngagementPct,
    exportDate,
  ]);
}
