import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=record; authority=class-teacher-math-coteacher-or-school-admin; rationale=misconception reads and governed reviews for a Grade 4 learner reached only through a class the learner is enrolled in where lib/authz/classAuthority grants class.read.learning with subject MATH (class teacher or MATH co-teacher), or by an ADMIN of the learner's school; others get the non-disclosing 404; canonical evidence references required (AT-GRADE-01 batch 3, CoS ruling 8)
import { requireRole } from "@/lib/auth";
import {
  GRADE4_MATH_ONTOLOGY_RELEASE,
  deterministicReleaseIdentity,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  appendGovernedMisconceptionReview,
  readCanonicalStudentConceptState,
} from "@/lib/learning-state/masteryWriter";
import { GRADE4_MATH_MISCONCEPTION_POLICY } from "@/lib/learning-state/misconceptionPolicy";
import { toDecisionModelLearnerState } from "@/lib/learning-state/studentLearningModel";
import { findStudentThroughClassAuthority } from "@/lib/authz/studentClassAccess";

export const dynamic = "force-dynamic";

async function findAuthorizedStudent(actor: { id: string; role: string; schoolId: string }, studentId: string) {
  // CoS ruling 8: the class teacher or a co-teacher assigned MATH for the learner's class; an ADMIN school-scoped.
  return findStudentThroughClassAuthority(actor, studentId, { fn: "class.read.learning", subject: "MATH" });
}

export async function GET(req: NextRequest) {
  const actor = await requireRole("TEACHER", "ADMIN");
  if (!actor.schoolId) return NextResponse.json({ error: "school_scope_required" }, { status: 403 });
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "student_id_required" }, { status: 400 });
  const student = await findAuthorizedStudent({ ...actor, schoolId: actor.schoolId }, studentId);
  if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  const asOf = new Date().toISOString();
  const states = await Promise.all(GRADE4_MATH_ONTOLOGY_RELEASE.concepts.map((concept) =>
    readCanonicalStudentConceptState({
      scope: {
        schoolId: actor.schoolId!,
        studentId: student.id,
        studentUserId: student.userId,
        conceptId: concept.id,
        ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
        ontologyReleaseIdentity: deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE),
      },
      asOf,
    })
  ));
  return NextResponse.json({
    studentId: student.id,
    asOf,
    suspectedSignals: states.flatMap((state) => state.misconceptions.map((signal) => ({
      conceptId: state.scope.conceptId,
      signalId: signal.signalId,
      status: signal.status,
      evidenceIds: signal.signalEvidenceIds,
      confirmingReviewIds: signal.confirmingReviewIds,
      rejectingReviewIds: signal.rejectingReviewIds,
      teacherExplanation: state.teacherExplanation,
    }))),
    administrativeGradeMayChange: false,
  });
}

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
  const student = await findAuthorizedStudent({ ...actor, schoolId: actor.schoolId }, body.studentId);
  if (!student) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  let result: Awaited<ReturnType<typeof appendGovernedMisconceptionReview>>;
  try {
    result = await appendGovernedMisconceptionReview({
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
  } catch (error) {
    if (error instanceof Error && error.message === "misconception_review_evidence_invalid") {
      return NextResponse.json({ error: "invalid_evidence_references" }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({
    duplicate: result.duplicate,
    learnerState: result.update.state,
    decisionModelInput: toDecisionModelLearnerState(result.update.state),
    administrativeGradeChanged: false,
  });
}
