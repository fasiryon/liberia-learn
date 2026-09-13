import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=student-membership; rationale=server-issued diagnostic sessions bind released items, policy, learner, and tenant
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import {
  admitEvidence,
  createDiagnosticResult,
  deterministicReleaseIdentity,
  GRADE4_MATH_ONTOLOGY_RELEASE,
  type DiagnosticKind,
} from "@/lib/learning-authority/governedGrade4Math";
import {
  diagnosticSessionId,
  openDiagnosticSession,
  sealDiagnosticSession,
} from "@/lib/learning-authority/diagnosticSession";

export const dynamic = "force-dynamic";

async function learner() {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findFirst({
    where: { userId: user.id, user: { schoolId: user.schoolId ?? null } },
    select: { id: true },
  });
  return { user, student };
}

export async function GET() {
  const { user, student } = await learner();
  if (!student || !user.schoolId) return NextResponse.json({ error: "student_not_found" }, { status: 404 });

  const initialEvidence = await prisma.learningEvent.findFirst({
    where: {
      schoolId: user.schoolId,
      userId: user.id,
      eventType: "learning.evidence_admission.recorded",
      metadata: { path: ["diagnosticKind"], equals: "INITIAL" },
    },
    select: { id: true },
  });
  const kind: DiagnosticKind = initialEvidence ? "CONTINUOUS" : "INITIAL";
  const item = kind === "INITIAL"
    ? GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === "g4-frac-diagnostic-equal-parts")
    : GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === "g4-frac-diagnostic-compare");
  if (!item) return NextResponse.json({ error: "governed_item_not_found" }, { status: 500 });

  const releaseIdentity = deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE);
  const sessionId = diagnosticSessionId({
    kind,
    schoolId: user.schoolId,
    studentId: student.id,
    releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
  });
  const token = sealDiagnosticSession({
    sessionId,
    kind,
    schoolId: user.schoolId,
    studentId: student.id,
    studentUserId: user.id,
    ontologyReleaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
    ontologyReleaseIdentity: releaseIdentity,
    itemId: item.id,
    itemVersion: item.version,
  });
  const binding = GRADE4_MATH_ONTOLOGY_RELEASE.bindings.find((candidate) => candidate.itemId === item.id);
  const toolPolicy = GRADE4_MATH_ONTOLOGY_RELEASE.toolPolicies.find((policy) => policy.id === binding?.toolPolicyId);
  const { correctIndex: _correctIndex, ...learnerItem } = item;
  const response = NextResponse.json({
    releaseId: GRADE4_MATH_ONTOLOGY_RELEASE.id,
    releaseIdentity,
    sessionId,
    kind,
    item: { ...learnerItem, toolPolicy },
  });
  response.cookies.set("g4_math_diagnostic_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/student/learning-authority/grade4-math",
    maxAge: 30 * 60,
  });
  return response;
}

export async function POST(req: NextRequest) {
  const { user, student } = await learner();
  if (!student || !user.schoolId) return NextResponse.json({ error: "student_not_found" }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.sessionId !== "string" || typeof body.itemId !== "string" ||
    typeof body.itemVersion !== "string" || !Number.isInteger(body.answerIndex)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const clientAuthorityFields = [
    "correctAnswer", "score", "mastery", "sessionKind", "idempotencyKey",
    "toolsUsed", "hintsUsed", "aiAssisted", "accommodationOverride",
  ];
  if (clientAuthorityFields.some((field) => body[field] !== undefined)) {
    return NextResponse.json({ error: "client_cannot_assert_session_scoring_or_policy_context" }, { status: 400 });
  }

  const session = openDiagnosticSession(
    req.cookies.get("g4_math_diagnostic_session")?.value ?? "",
    { sessionId: body.sessionId, schoolId: user.schoolId, studentId: student.id, studentUserId: user.id }
  );
  const releaseIdentity = deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE);
  if (!session ||
    session.ontologyReleaseId !== GRADE4_MATH_ONTOLOGY_RELEASE.id ||
    session.ontologyReleaseIdentity !== releaseIdentity ||
    session.itemId !== body.itemId ||
    session.itemVersion !== body.itemVersion) {
    return NextResponse.json({ error: "diagnostic_session_invalid_or_expired" }, { status: 400 });
  }
  const item = GRADE4_MATH_ONTOLOGY_RELEASE.items.find((candidate) => candidate.id === session.itemId);
  if (!item || item.context !== "DIAGNOSTIC" ||
    (body.answerIndex as number) < 0 || (body.answerIndex as number) >= item.options.length) {
    return NextResponse.json({ error: "governed_item_or_answer_invalid" }, { status: 400 });
  }

  const idempotencyKey = session.sessionId + ":" + item.id;
  const eventId = "g4math-" + createHash("sha256")
    .update([session.schoolId, session.studentUserId, idempotencyKey].join(":"))
    .digest("hex");
  const prior = await prisma.learningEvent.findFirst({
    where: { id: eventId, schoolId: user.schoolId, userId: user.id },
    select: { id: true },
  });
  if (prior) return NextResponse.json({ duplicate: true, admission: "NOT_REPEATED" });

  const admission = admitEvidence({
    idempotencyKey,
    schoolId: session.schoolId,
    authenticatedUserId: user.id,
    studentId: session.studentId,
    studentUserId: session.studentUserId,
    itemId: item.id,
    itemVersion: item.version,
    context: item.context,
    toolsUsed: [],
    hintsUsed: 0,
    aiAssisted: false,
    source: "ONLINE",
  }, {
    expectedSchoolId: user.schoolId,
    expectedStudentId: student.id,
    expectedStudentUserId: user.id,
    serverScored: true,
  });
  const correct = body.answerIndex === item.correctIndex;
  const binding = GRADE4_MATH_ONTOLOGY_RELEASE.bindings.find((candidate) => candidate.id === admission.bindingId);
  const diagnosticSession = admission.decision === "ACCEPTED" && binding
    ? createDiagnosticResult({
        kind: session.kind,
        idempotencyKey,
        schoolId: session.schoolId,
        studentId: session.studentId,
        studentUserId: session.studentUserId,
        releaseId: session.ontologyReleaseId,
        conceptObservations: [{ conceptId: binding.conceptId, confidence: correct ? 1 : 0 }],
        recommendedPrerequisiteConceptIds: correct ? [] : [binding.conceptId],
      })
    : null;

  try {
    await logLearningEvent({
      eventId,
      schoolId: session.schoolId,
      userId: session.studentUserId,
      studentId: session.studentId,
      actor: { type: "user", id: session.studentUserId, role: "STUDENT" },
      target: { type: "governed_grade4_math_item", id: item.id },
      eventType: "learning.evidence_admission.recorded",
      source: "/api/student/learning-authority/grade4-math",
      status: "evidence_admission_recorded",
      dedupeKey: idempotencyKey,
      metadata: {
        diagnosticSessionId: session.sessionId,
        diagnosticKind: session.kind,
        ontologyReleaseId: session.ontologyReleaseId,
        ontologyReleaseIdentity: session.ontologyReleaseIdentity,
        itemVersion: item.version,
        bindingId: admission.bindingId ?? null,
        evidenceDecision: admission.decision,
        evidenceReason: admission.reason,
        serverScored: true,
        correct,
        toolPolicyContext: "SERVER_ISSUED_NO_ASSISTANCE",
        learningEventIsCanonicalEvidence: false,
        masteryUpdated: false,
      },
    }, { throwOnError: true });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ duplicate: true, admission: "NOT_REPEATED" });
    }
    throw error;
  }

  return NextResponse.json({
    correct,
    admission,
    diagnosticSession,
    masteryUpdated: false,
    administrativeGradeChanged: false,
  });
}
