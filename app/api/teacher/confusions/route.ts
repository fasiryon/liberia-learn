import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isConfusionDetectionEnabled } from "@/lib/serverFlags";
import { getTeacherScope } from "@/lib/intelligence/teacherScope";

export const dynamic = "force-dynamic";

function severityWeight(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

export async function GET(req: NextRequest) {
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
    const scope = await getTeacherScope(user.id, user.schoolId);
    if (scope.studentIds.length === 0) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    if (studentId && !scope.studentIds.includes(studentId)) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    const rows = await (prisma as any).confusionSignal.findMany({
      where: {
        schoolId: user.schoolId,
        studentId: studentId ?? { in: scope.studentIds },
      },
      select: {
        id: true,
        studentId: true,
        lessonId: true,
        conceptTag: true,
        confusionType: true,
        severity: true,
        detectedAt: true,
      },
      take: 50,
    });

    rows.sort((a: any, b: any) => {
      const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    return NextResponse.json(
      rows.map((row: any) => ({
        id: row.id,
        studentId: row.studentId,
        studentName: scope.students.get(row.studentId)?.name ?? null,
        lessonId: row.lessonId,
        conceptTag: row.conceptTag,
        conceptLabel: row.conceptTag.split("::")[1] ?? row.conceptTag,
        confusionType: row.confusionType,
        severity: row.severity,
        detectedAt: row.detectedAt,
      }))
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load confusion signals" },
      { status: error?.status ?? 500 }
    );
  }
}
