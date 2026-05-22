import { NextResponse } from "next/server";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { prisma } from "@/lib/db";
import {
  anonymizeStudentId,
  buildCsv,
  formatExportDate,
  logStudentCohortExport,
  requireMoeExportUser,
} from "@/lib/moe/exportUtils";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { schoolId: string } }
) {
  if (!isMoePortalEnabled()) {
    return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  }

  try {
    const user = await requireMoeExportUser();
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_MOE);
    const schoolId = params.schoolId;
    await logStudentCohortExport({ userId: user.id, schoolId });
    void logDataAccess({
      userId: user.id,
      schoolId,
      resourceType: "moe_export",
      resourceId: schoolId,
      action: "download",
      scope: "school",
    });

    const students = await prisma.student.findMany({
      where: {
        user: { schoolId },
      },
      select: {
        id: true,
        userId: true,
        currentGrade: true,
        placementTests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { band: true },
        },
        examAttempts: {
          where: { submittedAt: { not: null } },
          select: { score: true },
        },
        assignmentSubmissions: {
          select: { id: true },
        },
        attendance: {
          select: { status: true },
        },
        interventionRecommendations: {
          where: { status: "pending" },
          select: { id: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const lessonCompletionCounts = await Promise.all(
      students.map((student) =>
        prisma.studentProgress.count({
          where: {
            studentId: student.userId,
            completedAt: { not: null },
          },
        })
      )
    );

    const rows = students.map((student, index) => {
      const attendanceTotal = student.attendance.length;
      const attendancePresent = student.attendance.filter(
        (record) => record.status === "PRESENT"
      ).length;
      const avgExamScore =
        student.examAttempts.length > 0
          ? Math.round(
              (student.examAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
                student.examAttempts.length) *
                10000
            ) / 100
          : 0;

      return [
        anonymizeStudentId(student.id, schoolId),
        student.currentGrade ?? "",
        student.placementTests[0]?.band ?? "",
        lessonCompletionCounts[index] ?? 0,
        avgExamScore,
        student.assignmentSubmissions.length,
        attendanceTotal > 0
          ? Math.round((attendancePresent / attendanceTotal) * 10000) / 100
          : 0,
        student.interventionRecommendations.length > 0 ? "Yes" : "No",
      ];
    });

    const exportDate = formatExportDate();
    const csv = buildCsv(
      [
        "Student ID",
        "Grade",
        "Placement Band",
        "Lessons Completed",
        "Avg Exam Score",
        "Assignments Submitted",
        "Attendance Rate %",
        "Intervention Flag",
      ],
      rows
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liberialearn-school-cohort-${schoolId}-${exportDate}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
