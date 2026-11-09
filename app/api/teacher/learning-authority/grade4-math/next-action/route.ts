import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=record; authority=class-teacher-math-coteacher-or-school-admin; rationale=a human override, restricted to server-derived published candidates, for a Grade 4 learner reached only through a class the learner is enrolled in where lib/authz/classAuthority grants class.read.learning with subject MATH (class teacher or MATH co-teacher), or by an ADMIN of the learner's school; others get the non-disclosing 404 before any decision is written (AT-GRADE-01 batch 3, CoS ruling 8)
import { requireRole } from "@/lib/auth";
import { decideGrade4LearningAction } from "@/lib/learning-authority/learningDecisionStore";
import { findStudentThroughClassAuthority } from "@/lib/authz/studentClassAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole("TEACHER", "ADMIN");
    if (!actor.schoolId) return NextResponse.json({ error: "school_scope_required" }, { status: 403 });
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.studentId !== "string" || typeof body.candidateId !== "string" ||
      typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000 ||
      typeof body.idempotencyKey !== "string" ||
      Object.keys(body).some((key) => !["studentId", "candidateId", "reason", "idempotencyKey"].includes(key))) {
      return NextResponse.json({ error: "invalid_override_payload" }, { status: 400 });
    }
    // CoS ruling 8: the class teacher or a co-teacher assigned MATH for the learner's class; an ADMIN school-scoped.
    const student = await findStudentThroughClassAuthority(actor, body.studentId, { fn: "class.read.learning", subject: "MATH", studentWhere: { currentGrade: 4 } });
    if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    const result = await decideGrade4LearningAction({
      schoolId: actor.schoolId, studentId: student.id, studentUserId: student.userId,
      idempotencyKey: body.idempotencyKey,
      teacherOverride: { candidateId: body.candidateId, actorId: actor.id,
        role: actor.role as "TEACHER" | "ADMIN", reason: body.reason },
    });
    return NextResponse.json({ decisionId: result.decision.id, action: result.decision.action,
      learnerStateRevision: result.decision.learnerStateRevision, override: result.resolution.teacherOverride,
      duplicate: result.duplicate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "learning_override_unavailable";
    const authStatus = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    const status = authStatus === 401 || authStatus === 403 ? authStatus :
      message === "decision_candidate_not_governed" ? 400 : message === "learner_state_stale" ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
