import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=teacher-admin-governed-override; rationale=human choice is restricted to server-derived published candidates and assigned classes
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decideGrade4LearningAction } from "@/lib/learning-authority/learningDecisionStore";
import { listAuthorizedClassIdsForTeacher } from "@/lib/records/schoolOperations";

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
    const classIds = actor.role === "TEACHER" ? await listAuthorizedClassIdsForTeacher(actor.id, actor.schoolId) : null;
    const student = await prisma.student.findFirst({
      where: { id: body.studentId, currentGrade: 4, user: { schoolId: actor.schoolId },
        ...(classIds ? { enrollments: { some: { Class: { schoolId: actor.schoolId, id: { in: classIds } } } } } : {}) },
      select: { id: true, userId: true },
    });
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
    const status = message === "decision_candidate_not_governed" ? 400 : message === "learner_state_stale" ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
