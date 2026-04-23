import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getClassPerformanceSummary } from "@/lib/intelligence/performanceAggregator";
import { buildTeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";
import { isConfusionDetectionEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isConfusionDetectionEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const [summary, classPerformance] = await Promise.all([
      getClassPerformanceSummary(user.id, user.schoolId),
      buildTeacherClassPerformance(user.id, user.schoolId),
    ]);
    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "teacher.performance.viewed",
      resourceType: "performance_summary",
      resourceId: user.id,
    });

    return NextResponse.json({
      ...summary,
      classInsights: classPerformance.map((entry) => ({
        classId: entry.classId,
        className: entry.className,
        subject: entry.subject,
        strugglingStudents: entry.intelligence?.strugglingStudents ?? entry.bottomStudents,
        topPerformers: entry.intelligence?.topPerformers ?? entry.topStudents,
        lowPerformingLessons:
          entry.intelligence?.lowPerformingLessons ??
          entry.lessonQuizPerformance.filter((lesson) => lesson.averageQuizScore < 70).slice(0, 3),
        interventionSuggestions: entry.intelligence?.interventionSuggestions ?? [],
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load performance summary" },
      { status: error?.status ?? 500 }
    );
  }
}
