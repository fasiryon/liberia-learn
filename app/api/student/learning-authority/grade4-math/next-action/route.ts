import { NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=governed-learning-orchestrator; rationale=only server-derived Grade 4 candidates reach the decision model
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decideGrade4LearningAction } from "@/lib/learning-authority/learningDecisionStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("STUDENT");
    if (!user.schoolId) return NextResponse.json({ error: "school_scope_required" }, { status: 403 });
    const student = await prisma.student.findFirst({
      where: { userId: user.id, currentGrade: 4, user: { schoolId: user.schoolId } }, select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "grade4_student_not_found" }, { status: 404 });
    const result = await decideGrade4LearningAction({
      schoolId: user.schoolId, studentId: student.id, studentUserId: user.id, idempotencyKey: "student-next-action-v1",
    });
    return NextResponse.json({
      action: result.decision.action, decisionId: result.decision.id,
      learnerStateRevision: result.decision.learnerStateRevision,
      ontologyReleaseId: result.decision.ontologyReleaseId,
      recommendationId: result.recommendation.id, resolutionId: result.resolution.id,
      fallbackReason: result.recommendation.fallbackReason,
      teacherOverride: result.resolution.teacherOverride
        ? { role: result.resolution.teacherOverride.role, reason: result.resolution.teacherOverride.reason }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "learning_decision_unavailable";
    const authStatus = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    const status = authStatus === 401 || authStatus === 403 ? authStatus : message === "learner_state_stale" ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
