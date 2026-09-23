// route-policy: auth=session; scope=tenant; authority=read-only-governed-projection; rationale=signals and evidence are server-derived and advisory
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
    const evidenceRowsRaw = await ((prisma as any).studentPerformanceEvent?.findMany?.({
      where: { schoolId: user.schoolId, studentId: { in: scope.studentIds } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { studentId: true, lessonId: true, score: true, attempts: true, eventType: true, createdAt: true },
    }) ?? Promise.resolve([])).catch(() => []);
    const evidenceRows = Array.isArray(evidenceRowsRaw) ? evidenceRowsRaw : [];
    const evidenceByKey = new Map<string, (typeof evidenceRows)[number]>();
    for (const evidence of evidenceRows) {
      const key = `${evidence.studentId}:${evidence.lessonId ?? "general"}`;
      if (!evidenceByKey.has(key)) evidenceByKey.set(key, evidence);
    }

    rows.sort((a: any, b: any) => {
      const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    const payload = rows.map((row: any) => ({
        id: row.id,
        studentId: row.studentId,
        studentName: scope.students.get(row.studentId)?.name ?? null,
        lessonId: row.lessonId,
        conceptTag: row.conceptTag,
        conceptLabel: row.conceptTag.split("::")[1] ?? row.conceptTag,
        confusionType: row.confusionType,
        severity: row.severity,
        detectedAt: row.detectedAt,
        evidence: (() => {
          const evidence = evidenceByKey.get(`${row.studentId}:${row.lessonId ?? "general"}`);
          if (!evidence) return { status: "missing", summary: "No matching performance evidence is available yet." };
          const scorePct = Math.round(evidence.score * 100);
          return { status: scorePct < 60 ? "weak" : "recent", summary: `${evidence.eventType.replace(/_/g, " ")} evidence: ${scorePct}% across ${evidence.attempts} attempt${evidence.attempts === 1 ? "" : "s"}.`, recordedAt: evidence.createdAt };
        })(),
        whyFlagged: row.severity === "high"
          ? "A high-priority learning signal was detected and needs teacher review."
          : row.severity === "medium"
            ? "A repeated or meaningful learning signal was detected for teacher review."
            : "A lower-priority learning signal was detected for teacher review.",
      }));
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load confusion signals" },
      { status: error?.status ?? 500 }
    );
  }
}
