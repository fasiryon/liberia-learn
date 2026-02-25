/**
 * lib/exports/governanceExport.ts — MOE Governance Export Builders (Block 6)
 *
 * Three safe export types:
 *  1. Student Performance Aggregates  — per-school counts + homework rates (PII-free)
 *  2. Class Summary                   — class/student/teacher distribution (PII-free)
 *  3. Monthly Report                  — comprehensive month-window summary (PII-free)
 *
 * All exports:
 *  - Create an ExportRecord row for governance record-keeping
 *  - Call logAudit() with traceId for request correlation
 *  - Emit a gov.export.generated metric event
 *  - Are PII-free by default (aggregate counts only)
 *
 * PII exports are NOT implemented here; they require GOVERNANCE_EXPORT_PII
 * permission + ENABLE_GOV_STUDENT_PII_EXPORT flag and are future scope.
 */
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";

// ── CSV helpers ────────────────────────────────────────────────────────────────

function csvEscape(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const h = headers.map(csvEscape).join(",");
  const d = rows.map((r) => r.map(csvEscape).join(","));
  return [h, ...d].join("\n");
}

// ── 1. Student Performance Aggregates ─────────────────────────────────────────

export interface StudentPerformanceRow {
  schoolId: string;
  schoolName: string;
  county: string | null;
  district: string | null;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  homeworkAssigned: number;
  homeworkSubmitted: number;
  completionRatePct: string;
  lessonsViewed: number;
}

/**
 * Builds a student performance aggregate export.
 * schoolId=null means national scope (platform admin only).
 * No student PII — only aggregate counts per school.
 */
export async function buildStudentPerformanceExport({
  userId,
  schoolId,
  format,
  traceId,
}: {
  userId: string | null;
  schoolId: string | null;
  format: "csv" | "json";
  traceId?: string;
}): Promise<{ contentType: string; body: string }> {
  const schoolWhere = schoolId ? { id: schoolId } : {};

  const schools = await prisma.school.findMany({
    where: schoolWhere,
    select: { id: true, name: true, county: true, district: true },
    orderBy: { name: "asc" },
  });

  const rows: StudentPerformanceRow[] = await Promise.all(
    schools.map(async (school) => {
      const [
        totalStudents,
        totalTeachers,
        totalClasses,
        homeworkAssigned,
        homeworkSubmitted,
        lessonsViewed,
      ] = await Promise.all([
        prisma.user.count({ where: { role: "STUDENT", schoolId: school.id } }),
        prisma.user.count({ where: { role: "TEACHER", schoolId: school.id } }),
        prisma.class.count({ where: { schoolId: school.id } }),
        prisma.homework.count({ where: { Class: { schoolId: school.id } } }),
        prisma.auditLog.count({
          where: { action: "homework_submit", user: { schoolId: school.id } },
        }),
        prisma.auditLog.count({
          where: { action: "lesson_view", user: { schoolId: school.id } },
        }),
      ]);

      const completionRatePct =
        homeworkAssigned > 0
          ? `${((homeworkSubmitted / homeworkAssigned) * 100).toFixed(1)}%`
          : "N/A";

      return {
        schoolId: school.id,
        schoolName: school.name,
        county: school.county,
        district: school.district,
        totalStudents,
        totalTeachers,
        totalClasses,
        homeworkAssigned,
        homeworkSubmitted,
        completionRatePct,
        lessonsViewed,
      };
    })
  );

  const scope = schoolId ? "school" : "national";
  await _recordExportAudit({
    userId,
    exportType: "student_performance",
    scope,
    schoolId,
    format,
    rowCount: rows.length,
    traceId,
  });

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(rows),
    };
  }

  return {
    contentType: "text/csv; charset=utf-8",
    body: toCSV(
      [
        "School ID",
        "School Name",
        "County",
        "District",
        "Students",
        "Teachers",
        "Classes",
        "HW Assigned",
        "HW Submitted",
        "Completion %",
        "Lessons Viewed",
      ],
      rows.map((r) => [
        r.schoolId,
        r.schoolName,
        r.county,
        r.district,
        r.totalStudents,
        r.totalTeachers,
        r.totalClasses,
        r.homeworkAssigned,
        r.homeworkSubmitted,
        r.completionRatePct,
        r.lessonsViewed,
      ])
    ),
  };
}

// ── 2. Class Summary Export ───────────────────────────────────────────────────

export interface ClassSummaryRow {
  schoolId: string;
  schoolName: string;
  classCount: number;
  totalStudents: number;
  totalTeachers: number;
  avgStudentsPerClass: string;
  totalHomeworkItems: number;
  submissionRate: string;
}

/**
 * Builds a class-level summary export.
 * Aggregate counts per school — no class names or teacher identifiers.
 */
export async function buildClassSummaryExport({
  userId,
  schoolId,
  format,
  traceId,
}: {
  userId: string | null;
  schoolId: string | null;
  format: "csv" | "json";
  traceId?: string;
}): Promise<{ contentType: string; body: string }> {
  const schoolWhere = schoolId ? { id: schoolId } : {};

  const schools = await prisma.school.findMany({
    where: schoolWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows: ClassSummaryRow[] = await Promise.all(
    schools.map(async (school) => {
      const [classCount, totalStudents, totalTeachers, hwItems, hwSubmits] =
        await Promise.all([
          prisma.class.count({ where: { schoolId: school.id } }),
          prisma.user.count({ where: { role: "STUDENT", schoolId: school.id } }),
          prisma.user.count({ where: { role: "TEACHER", schoolId: school.id } }),
          prisma.homework.count({ where: { Class: { schoolId: school.id } } }),
          prisma.auditLog.count({
            where: { action: "homework_submit", user: { schoolId: school.id } },
          }),
        ]);

      return {
        schoolId: school.id,
        schoolName: school.name,
        classCount,
        totalStudents,
        totalTeachers,
        avgStudentsPerClass:
          classCount > 0 ? (totalStudents / classCount).toFixed(1) : "N/A",
        totalHomeworkItems: hwItems,
        submissionRate:
          hwItems > 0
            ? `${((hwSubmits / hwItems) * 100).toFixed(1)}%`
            : "N/A",
      };
    })
  );

  const scope = schoolId ? "school" : "national";
  await _recordExportAudit({
    userId,
    exportType: "class_summary",
    scope,
    schoolId,
    format,
    rowCount: rows.length,
    traceId,
  });

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(rows),
    };
  }

  return {
    contentType: "text/csv; charset=utf-8",
    body: toCSV(
      [
        "School ID",
        "School Name",
        "Class Count",
        "Total Students",
        "Total Teachers",
        "Avg Students/Class",
        "HW Items",
        "Submission Rate",
      ],
      rows.map((r) => [
        r.schoolId,
        r.schoolName,
        r.classCount,
        r.totalStudents,
        r.totalTeachers,
        r.avgStudentsPerClass,
        r.totalHomeworkItems,
        r.submissionRate,
      ])
    ),
  };
}

// ── 3. Monthly Report Export ──────────────────────────────────────────────────

export interface MonthlyReportData {
  reportMonth: string;
  generatedAt: string;
  scope: "school" | "national";
  scopeId: string | null;
  enrollment: {
    students: number;
    teachers: number;
    schools: number;
  };
  activity: {
    lessonsViewed: number;
    homeworkSubmitted: number;
    smsDelivered: number;
    smsFailed: number;
  };
  exports: {
    totalExports: number;
    byType: Record<string, number>;
  };
  training: {
    completionsThisMonth: number;
  };
  auditEvents: {
    totalAuditEntries: number;
    byAction: Record<string, number>;
  };
}

/**
 * Builds a monthly summary report for a given year-month.
 * yearMonth: "YYYY-MM" (e.g. "2026-02")
 * schoolId=null means national scope (platform admin only).
 */
export async function buildMonthlyReportExport({
  userId,
  schoolId,
  yearMonth,
  format,
  traceId,
}: {
  userId: string | null;
  schoolId: string | null;
  yearMonth: string;
  format: "csv" | "json";
  traceId?: string;
}): Promise<{ contentType: string; body: string }> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw Object.assign(
      new Error("Invalid yearMonth format — expected YYYY-MM"),
      { status: 400 }
    );
  }

  const [year, month] = yearMonth.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1)); // exclusive upper bound

  const schoolFilter = schoolId ? { id: schoolId } : {};
  const userSchoolFilter = schoolId ? { schoolId } : {};

  const [students, teachers, schoolCount] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT", ...userSchoolFilter } }),
    prisma.user.count({ where: { role: "TEACHER", ...userSchoolFilter } }),
    prisma.school.count({ where: schoolFilter }),
  ]);

  const timeWindow = { gte: from, lt: to };

  const auditUserFilter = schoolId
    ? { user: { schoolId } }
    : {};

  const [lessonsViewed, homeworkSubmitted] = await Promise.all([
    prisma.auditLog.count({
      where: { action: "lesson_view", createdAt: timeWindow, ...auditUserFilter },
    }),
    prisma.auditLog.count({
      where: { action: "homework_submit", createdAt: timeWindow, ...auditUserFilter },
    }),
  ]);

  const smsWhere = {
    createdAt: timeWindow,
    ...(schoolId ? { schoolId } : {}),
  };

  const [smsDelivered, smsFailed] = await Promise.all([
    prisma.sMSDeliveryLog.count({ where: { ...smsWhere, status: "delivered" } }),
    prisma.sMSDeliveryLog.count({ where: { ...smsWhere, status: "failed" } }),
  ]);

  const exportRecords = await prisma.exportRecord.findMany({
    where: {
      createdAt: timeWindow,
      ...(schoolId ? { scopeId: schoolId } : {}),
    },
    select: { exportType: true },
  });

  const byType: Record<string, number> = {};
  for (const r of exportRecords) {
    byType[r.exportType] = (byType[r.exportType] ?? 0) + 1;
  }

  const trainingCompletions = await prisma.trainingProgress.count({
    where: {
      status: "complete",
      completedAt: timeWindow,
      ...(schoolId ? { User: { schoolId } } : {}),
    },
  });

  const auditEntries = await prisma.auditLog.findMany({
    where: {
      createdAt: timeWindow,
      ...(schoolId ? { schoolId } : {}),
    },
    select: { action: true },
  });

  const byAction: Record<string, number> = {};
  for (const e of auditEntries) {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
  }

  const scope: "school" | "national" = schoolId ? "school" : "national";

  const report: MonthlyReportData = {
    reportMonth: yearMonth,
    generatedAt: new Date().toISOString(),
    scope,
    scopeId: schoolId,
    enrollment: { students, teachers, schools: schoolCount },
    activity: { lessonsViewed, homeworkSubmitted, smsDelivered, smsFailed },
    exports: { totalExports: exportRecords.length, byType },
    training: { completionsThisMonth: trainingCompletions },
    auditEvents: { totalAuditEntries: auditEntries.length, byAction },
  };

  await _recordExportAudit({
    userId,
    exportType: "monthly_report",
    scope,
    schoolId,
    format,
    rowCount: 1,
    traceId,
    filters: { yearMonth },
  });

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(report),
    };
  }

  // Flatten report into key-value CSV rows
  const csvRows: (string | number | null)[][] = [
    ["Report Month", report.reportMonth],
    ["Generated At", report.generatedAt],
    ["Scope", report.scope],
    ["Scope ID", report.scopeId ?? "national"],
    ["", ""],
    ["-- ENROLLMENT --", ""],
    ["Students", report.enrollment.students],
    ["Teachers", report.enrollment.teachers],
    ["Schools", report.enrollment.schools],
    ["", ""],
    ["-- ACTIVITY --", ""],
    ["Lessons Viewed", report.activity.lessonsViewed],
    ["Homework Submitted", report.activity.homeworkSubmitted],
    ["SMS Delivered", report.activity.smsDelivered],
    ["SMS Failed", report.activity.smsFailed],
    ["", ""],
    ["-- TRAINING --", ""],
    ["Completions This Month", report.training.completionsThisMonth],
    ["", ""],
    ["-- EXPORTS --", ""],
    ["Total Exports", report.exports.totalExports],
    ...Object.entries(report.exports.byType).map(([t, c]) => [`  ${t}`, c]),
    ["", ""],
    ["-- AUDIT EVENTS --", ""],
    ["Total Entries", report.auditEvents.totalAuditEntries],
    ...Object.entries(report.auditEvents.byAction).map(([a, c]) => [
      `  ${a}`,
      c,
    ]),
  ];

  return {
    contentType: "text/csv; charset=utf-8",
    body: toCSV(["Metric", "Value"], csvRows),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _recordExportAudit({
  userId,
  exportType,
  scope,
  schoolId,
  format,
  rowCount,
  traceId,
  filters = {},
}: {
  userId: string | null;
  exportType: string;
  scope: string;
  schoolId: string | null;
  format: string;
  rowCount: number;
  traceId?: string;
  filters?: Record<string, unknown>;
}) {
  const exportRecord = await prisma.exportRecord.create({
    data: {
      userId,
      exportType,
      scope,
      scopeId: schoolId,
      filters: { ...filters, piiIncluded: false },
      format,
      pilotOnly: false,
    },
  });

  await logAudit({
    userId,
    action: `export.${exportType}`,
    resourceType: "export",
    resourceId: exportRecord.id,
    schoolId,
    traceId,
    details: { scope, format, rowCount, ...filters },
  });

  await recordMetricEvent(
    "gov.export.generated",
    { exportType, format, rowCount },
    {
      scope: scope as any,
      scopeId: schoolId,
      schoolId,
      userId,
      severity: "info",
      kind: "counter",
      pilotOnly: false,
    }
  );
}
