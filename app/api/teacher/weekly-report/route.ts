import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { buildTeacherWeeklyReport } from "@/lib/reporting/teacherWeeklyReport";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { randomUUID } from "crypto";
import { isWeeklyTeacherReportsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/weekly-report
 *
 * Returns a 7-day class summary for the authenticated teacher.
 * Accepts optional ?date=YYYY-MM-DD to anchor the week (defaults to today).
 * Fires a logLearningEvent("teacher.weekly_report.viewed") for analytics.
 */
export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    if (!isWeeklyTeacherReportsEnabled()) {
      return NextResponse.json({ error: "weekly_teacher_reports_disabled" }, { status: 404 });
    }

    const user = await requireRole("TEACHER", "ADMIN");

    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const dateParam = req.nextUrl.searchParams.get("date");
    const referenceDate = dateParam ? new Date(dateParam) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      return NextResponse.json({ error: "Invalid date parameter" }, { status: 400 });
    }

    const report = await buildTeacherWeeklyReport(user.id, user.schoolId, referenceDate);

    // Fire-and-forget analytics event
    logLearningEvent({
      schoolId: user.schoolId,
      userId: user.id,
      eventType: "teacher.weekly_report.viewed",
      source: "teacher_portal",
      actor: { type: "teacher", id: user.id, role: user.role },
      metadata: {
        weekStart: report.weekStart,
        classCount: report.classes.length,
        totalLessons: report.totalLessons,
      },
    }).catch(() => {
      // best-effort
    });

    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/teacher/weekly-report", method: "GET" });
  }
}
