import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordPerformanceEvent } from "@/lib/intelligence/recordPerformanceEvent";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { analyzeLabSession } from "@/lib/ai/lab/labAnalyzer";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/labs/[labId]/session
 * Part 7: Start a virtual lab session for a student.
 * Validates that the student has a pre-created LabSession for this lab.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("STUDENT");
    const { labId } = params;

    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    // Find the existing session created by the teacher link action
    const session = await prisma.labSession.findFirst({
      where: {
        labId,
        studentId: user.id,
        schoolId: user.schoolId,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "No session found for this lab" }, { status: 404 });
    }

    const payload = await req.json().catch(() => null);
    const hasSubmission =
      payload &&
      typeof payload === "object" &&
      payload !== null &&
      (payload.observations !== undefined || payload.conclusions !== undefined);

    if (hasSubmission) {
      const lab = await prisma.virtualLab.findUnique({ where: { labId } });
      if (!lab) {
        return NextResponse.json({ error: "Lab not found" }, { status: 404 });
      }

      const observations =
        payload && typeof payload.observations === "object" && payload.observations !== null
          ? payload.observations
          : {};
      const conclusions =
        typeof payload?.conclusions === "string"
          ? payload.conclusions
          : JSON.stringify(payload?.conclusions ?? {});

      const analysis = await analyzeLabSession({
        lab: {
          title: lab.title,
          subject: lab.subject,
          gradeLevel: lab.grade,
          ...(typeof (lab.payload as any)?.labObjective === "string"
            ? { labObjective: (lab.payload as any).labObjective }
            : {}),
          ...(Array.isArray((lab.payload as any)?.analysisQuestions)
            ? { analysisQuestions: (lab.payload as any).analysisQuestions }
            : {}),
          ...(typeof (lab.payload as any)?.connectionToLesson === "string"
            ? { connectionToLesson: (lab.payload as any).connectionToLesson }
            : {}),
        },
        observations,
        conclusions,
        gradeLevel: lab.grade,
      });

      const completedSession = await prisma.labSession.update({
        where: { id: session.id },
        data: {
          startedAt: session.startedAt ?? new Date(),
          completedAt: new Date(),
          observations,
          conclusions,
          score: analysis.suggestedScore,
          aiAnalysis: analysis,
        },
      });

      await logAudit({
        userId: user.id,
        action: "lab.session.complete",
        resourceType: "labSession",
        resourceId: session.id,
        schoolId: user.schoolId,
        details: { labId, suggestedScore: analysis.suggestedScore },
      });

      const studentRecord = await prisma.student.findUnique({
        where: { userId: user.id },
        select: { id: true, currentGrade: true },
      });
      if (studentRecord) {
        void recordPerformanceEvent({
          studentId: studentRecord.id,
          schoolId: user.schoolId,
          subject: lab.subject,
          gradeLevel: studentRecord.currentGrade ?? lab.grade,
          eventType: "lab",
          score: analysis.suggestedScore / 100,
          durationSeconds: Math.max(
            0,
            Math.round(
              ((completedSession.completedAt ?? new Date()).getTime() - completedSession.startedAt.getTime()) /
                1000
            )
          ),
          attempts: 1,
          aiAssistUsed: false,
          lessonId: labId,
        }).catch((eventError) => {
          console.error("[lab.session.performanceEvent]", eventError);
        });
      }

      return NextResponse.json({ session: completedSession, aiAnalysis: analysis });
    }

    // If already started, just return the session
    if (session.completedAt) {
      return NextResponse.json({ session });
    }

    // Update startedAt if this is the first access
    const updated = await prisma.labSession.update({
      where: { id: session.id },
      data: { startedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      action: "lab.session.start",
      resourceType: "labSession",
      resourceId: session.id,
      schoolId: user.schoolId,
      details: { labId },
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to start session" },
      { status: err?.status ?? 500 }
    );
  }
}
