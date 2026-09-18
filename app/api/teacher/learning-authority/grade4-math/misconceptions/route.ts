import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=teacher-admin-governed-review; rationale=misconception decisions require same-school human authority and canonical evidence references
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await requireRole("TEACHER", "ADMIN");
  if (!actor.schoolId) return NextResponse.json({ error: "school_scope_required" }, { status: 403 });
  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) return NextResponse.json({ error: "student_id_required" }, { status: 400 });
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      user: { schoolId: actor.schoolId },
      ...(actor.role === "TEACHER" ? {
        enrollments: { some: { Class: { schoolId: actor.schoolId, teacherId: actor.id } } },
      } : {}),
    },
    select: { id: true, userId: true },
  });
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
  const student = await prisma.student.findFirst({
    where: {
      id: body.studentId,
      user: { schoolId: actor.schoolId },
      ...(actor.role === "TEACHER" ? {
        enrollments: { some: { Class: { schoolId: actor.schoolId, teacherId: actor.id } } },
      } : {}),
    },
    select: { id: true, userId: true },
  });
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
