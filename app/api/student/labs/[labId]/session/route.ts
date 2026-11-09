import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=record; authority=student-session-enrollment; rationale=practical lab mutations require published runtime and own-school enrolled assignment
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";
import { analyzeLabSession } from "@/lib/ai/lab/labAnalyzer";
import { loadAuthorizedPracticalSessions, studentSessionSummary } from "@/lib/student/labEligibility";

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
    const payload = await req.json().catch(() => null);
    const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId : undefined;
    const [authorized] = await loadAuthorizedPracticalSessions(user, { labId, sessionId });
    const session = authorized?.session;

    if (!session) {
      return NextResponse.json({ error: "No session found for this lab" }, { status: 404 });
    }

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

      // AT-R-LAB: the AI outcome is never learner attainment here. A withheld analysis has no score; a model
      // suggestion is kept only as a PROVISIONAL, AI-scored note inside aiAnalysis. labSession.score stays empty until
      // a teacher reviews (PATCH /api/teacher/labs/sessions/[sessionId]), and no lab performance event is recorded
      // from an AI analysis.
      let completedSession: Awaited<ReturnType<typeof prisma.labSession.update>>;
      try {
        completedSession = await prisma.$transaction(async (tx) => {
          const updated = await tx.labSession.update({
            where: { id: session.id },
            data: {
              startedAt: session.startedAt ?? new Date(),
              completedAt: new Date(),
              observations,
              conclusions,
              score: null,
              aiAnalysis: analysis,
            },
          });
          return updated;
        });
      } catch (txErr) {
        console.error("[lab.session] transaction failed:", txErr);
        throw txErr;
      }

      void logAudit({
        userId: user.id,
        action: "lab.session.complete",
        resourceType: "labSession",
        resourceId: session.id,
        schoolId: user.schoolId,
        details: { labId, analysisStatus: analysis.status, provisionalSuggestedScore: analysis.suggestedScore, scorer: analysis.scoreProvenance?.scorer ?? null },
      });

      return NextResponse.json({ session: studentSessionSummary(completedSession) });
    }

    // If already started, just return the session
    if (session.completedAt) {
      return NextResponse.json({ session: studentSessionSummary(session) });
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

    return NextResponse.json({ session: studentSessionSummary(updated) });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unable to access lab session" },
      { status: err?.status ?? 500 }
    );
  }
}
