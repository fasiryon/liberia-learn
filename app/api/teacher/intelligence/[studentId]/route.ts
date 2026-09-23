// route-policy: auth=session; scope=tenant; authority=read-only-governed-projection; rationale=student intelligence is limited to enrolled students and cannot write canonical state
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStudentPerformanceSummary } from "@/lib/intelligence/performanceAggregator";
import { getTeacherScope } from "@/lib/intelligence/teacherScope";
import { isTeacherIntelligenceDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { studentId: string } }
) {
  try {
    if (!isTeacherIntelligenceDashboardEnabled()) {
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
    const scopedStudent = scope.students.get(params.studentId);
    if (!scopedStudent) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const [summary, signals, interventions, evidenceResult] = await Promise.all([
      getStudentPerformanceSummary(params.studentId, user.schoolId),
      (prisma as any).confusionSignal.findMany({
        where: { studentId: params.studentId, schoolId: user.schoolId },
        orderBy: { detectedAt: "desc" },
        take: 10,
        select: {
          id: true,
          lessonId: true,
          conceptTag: true,
          confusionType: true,
          severity: true,
          detectedAt: true,
        },
      }),
      (prisma as any).interventionRecommendation.findMany({
        where: { studentId: params.studentId, schoolId: user.schoolId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          recommendationType: true,
          reason: true,
          confidenceScore: true,
          status: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      (async () => {
        const findPerformanceEvents = (prisma as any).studentPerformanceEvent?.findMany;
        if (typeof findPerformanceEvents !== "function") return { available: false, rows: [] };
        try {
          const rows = await findPerformanceEvents({
            where: { studentId: params.studentId, schoolId: user.schoolId },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { lessonId: true, score: true, attempts: true, eventType: true, createdAt: true },
          });
          return { available: Array.isArray(rows), rows: Array.isArray(rows) ? rows : [] };
        } catch {
          return { available: false, rows: [] };
        }
      })(),
    ]);
    const evidenceRows = evidenceResult.rows;

    return NextResponse.json({
      student: {
        id: scopedStudent.id,
        name: scopedStudent.name,
        currentGrade: scopedStudent.currentGrade,
        className: scopedStudent.className,
      },
      summary,
      evidenceAvailable: evidenceResult.available,
      signals: signals.map((signal: any) => ({
        ...signal,
        conceptLabel: signal.conceptTag.split("::")[1] ?? signal.conceptTag,
        evidence: (() => {
          if (!evidenceResult.available) return { status: "unavailable", summary: "Performance evidence is temporarily unavailable." };
          const evidence = evidenceRows
            .filter((candidate: any) => candidate.lessonId === signal.lessonId && new Date(candidate.createdAt) <= new Date(signal.detectedAt))
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          if (!evidence) return { status: "missing", summary: "No matching performance evidence is available yet." };
          const scorePct = Math.round(evidence.score * 100);
          return { status: scorePct < 60 ? "weak" : "recent", summary: `${evidence.eventType.replace(/_/g, " ")} evidence: ${scorePct}% across ${evidence.attempts} attempt${evidence.attempts === 1 ? "" : "s"}.`, recordedAt: evidence.createdAt };
        })(),
        whyFlagged: signal.severity === "high"
          ? "A high-priority learning signal was detected and needs teacher review."
          : signal.severity === "medium"
            ? "A repeated or meaningful learning signal was detected for teacher review."
            : "A lower-priority learning signal was detected for teacher review.",
      })),
      interventions,
      hasGuardianSupportRecommendation: interventions.some(
        (intervention: any) =>
          intervention.recommendationType === "guardian_support" &&
          intervention.status === "pending"
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load student intelligence" },
      { status: error?.status ?? 500 }
    );
  }
}
