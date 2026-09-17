import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=teacher-admin-governed-review; rationale=misconception decisions require same-school human authority and canonical evidence references
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  deterministicReleaseIdentity,
} from "@/lib/learning-authority/governedGrade4Math";
import { appendGovernedMisconceptionReview } from "@/lib/learning-state/masteryWriter";
import { GRADE4_MATH_MISCONCEPTION_POLICY } from "@/lib/learning-state/misconceptionPolicy";
import { toDecisionModelLearnerState } from "@/lib/learning-state/studentLearningModel";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await requireRole("TEACHER", "ADMIN");
  if (!actor.schoolId) return NextResponse.json({ error: "school_scope_required" }, { status: 403 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.studentId !== "string" || typeof body.conceptId !== "string" ||
    typeof body.signalId !== "string" || !["CONFIRMED", "REJECTED"].includes(String(body.decision)) ||
    !Array.isArray(body.evidenceIds) || body.evidenceIds.length === 0 ||
    body.evidenceIds.some((id) => typeof id !== "string" || id.length === 0)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!GRADE4_MATH_ONTOLOGY_RELEASE.concepts.some((concept) => concept.id === body.conceptId) ||
    !GRADE4_MATH_MISCONCEPTION_POLICY.definitions.some((signal) => signal.id === body.signalId)) {
    return NextResponse.json({ error: "governed_concept_or_signal_not_found" }, { status: 400 });
  }
  const student = await prisma.student.findFirst({
    where: { id: body.studentId, user: { schoolId: actor.schoolId } },
    select: { id: true, userId: true },
  });
  if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  const result = await appendGovernedMisconceptionReview({
    scope: {
      schoolId: actor.schoolId,
      studentId: student.id,
      studentUserId: student.userId,
      conceptId: body.conceptId,
      ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
      ontologyReleaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE),
    },
    signalId: body.signalId,
    decision: body.decision as "CONFIRMED" | "REJECTED",
    evidenceIds: body.evidenceIds as string[],
    actorUserId: actor.id,
    occurredAt: new Date().toISOString(),
  });
  return NextResponse.json({
    duplicate: result.duplicate,
    learnerState: result.update.state,
    decisionModelInput: toDecisionModelLearnerState(result.update.state),
    administrativeGradeChanged: false,
  });
}
