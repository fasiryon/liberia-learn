import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=governed-learning-orchestrator; rationale=the sealed item is bound to a persisted decision and server-scored evidence
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishedReleaseForLearner } from "@/lib/learning-authority/publishedReleases";
import { decideLearningAction } from "@/lib/learning-authority/learningDecisionStore";
import { deterministicReleaseIdentity, admitEvidence } from "@/lib/learning-authority/governedGrade4Math";
import { openDiagnosticSession, sealDiagnosticSession } from "@/lib/learning-authority/diagnosticSession";
import { appendCanonicalMasteryUpdate } from "@/lib/learning-state/masteryWriter";
import { toLearnerSafeStudentConceptState } from "@/lib/learning-state/studentLearningModel";

export const dynamic = "force-dynamic";
const cookieName = "governed_learning_action";

async function context() {
  const user = await requireRole("STUDENT");
  if (!user.schoolId) throw Object.assign(new Error("school_scope_required"), { status: 403 });
  const student = await prisma.student.findFirst({
    where: { userId: user.id, user: { schoolId: user.schoolId } },
    select: { id: true, currentGrade: true },
  });
  if (!student) throw Object.assign(new Error("student_not_found"), { status: 404 });
  const release = publishedReleaseForLearner(student.currentGrade ?? -1);
  return { user, student, release };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "learning_action_unavailable";
  const supplied = typeof error === "object" && error !== null && "status" in error ? error.status : null;
  const status = supplied === 401 || supplied === 403 || supplied === 404 ? supplied :
    message === "learner_state_stale" || message === "decision_stale" ? 409 : 503;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { user, student, release } = await context();
    if (!release) return NextResponse.json({ available: false });
    const result = await decideLearningAction({ schoolId: user.schoolId!, studentId: student.id,
      studentUserId: user.id, idempotencyKey: "student-next-action-v2", release });
    const action = result.decision.action;
    const item = release.items.find((candidate) => candidate.id === action.itemId);
    const binding = release.bindings.find((candidate) => candidate.itemId === item?.id && candidate.itemVersion === item.version);
    const policy = release.toolPolicies.find((candidate) => candidate.id === binding?.toolPolicyId);
    if (!item || !binding || !policy) throw new Error("governed_item_unavailable");
    let lessonHref: string | null = null;
    if (binding.lessonContentId) {
      const lesson = await prisma.curriculumContent.findFirst({ where: {
        contentId: binding.lessonContentId, grade: release.grade, subject: release.subject,
        schoolId: null, status: { in: ["published", "APPROVED"] },
      }, select: { contentId: true } });
      if (!lesson) throw new Error("governed_lesson_unavailable");
      lessonHref = `/student/lesson/${encodeURIComponent(lesson.contentId)}`;
    }
    const { correctIndex: _answer, hint: _hint, workedExample: _example, ...learnerItem } = item;
    const sessionId = result.decision.id;
    const response = NextResponse.json({ available: true, decisionId: result.decision.id,
      learnerStateRevision: result.decision.learnerStateRevision, releaseId: release.id,
      releaseIdentity: result.decision.ontologyReleaseIdentity,
      grade: release.grade, subject: release.subject, action, conceptLabel: release.concepts.find((concept) => concept.id === action.conceptId)?.label,
      item: learnerItem, toolPolicy: policy, sessionId,
      lessonHref });
    response.cookies.set(cookieName, sealDiagnosticSession({ sessionId, decisionId: result.decision.id,
      kind: "CONTINUOUS", schoolId: user.schoolId!, studentId: student.id, studentUserId: user.id,
      ontologyReleaseId: release.id, ontologyReleaseIdentity: deterministicReleaseIdentity(release),
      itemId: item.id, itemVersion: item.version }), {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
      path: "/api/student/learning-authority", maxAge: 30 * 60,
    });
    return response;
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { user, student, release } = await context();
    if (!release) return NextResponse.json({ error: "governed_release_unavailable" }, { status: 404 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !["decisionId", "sessionId", "itemId", "itemVersion", "answerIndex", "toolsUsed"].includes(key)) ||
      typeof body.decisionId !== "string" || typeof body.sessionId !== "string" ||
      typeof body.itemId !== "string" || typeof body.itemVersion !== "string" || !Number.isInteger(body.answerIndex) ||
      (body.toolsUsed !== undefined && (!Array.isArray(body.toolsUsed) || body.toolsUsed.length > 8 ||
        body.toolsUsed.some((tool) => typeof tool !== "string")))) {
      return NextResponse.json({ error: "invalid_answer_payload" }, { status: 400 });
    }
    const session = openDiagnosticSession(request.cookies.get(cookieName)?.value ?? "", {
      sessionId: body.sessionId, schoolId: user.schoolId!, studentId: student.id, studentUserId: user.id,
    });
    if (!session || session.decisionId !== body.decisionId || session.sessionId !== body.decisionId ||
      session.ontologyReleaseId !== release.id || session.ontologyReleaseIdentity !== deterministicReleaseIdentity(release) ||
      session.itemId !== body.itemId || session.itemVersion !== body.itemVersion) {
      return NextResponse.json({ error: "action_session_invalid_or_expired" }, { status: 400 });
    }
    const current = await decideLearningAction({ schoolId: user.schoolId!, studentId: student.id,
      studentUserId: user.id, idempotencyKey: "student-next-action-v2", release });
    if (current.decision.id !== session.decisionId || current.decision.action.itemId !== session.itemId) {
      return NextResponse.json({ error: "decision_stale" }, { status: 409 });
    }
    const item = release.items.find((candidate) => candidate.id === session.itemId && candidate.version === session.itemVersion);
    if (!item || (body.answerIndex as number) < 0 || (body.answerIndex as number) >= item.options.length) {
      return NextResponse.json({ error: "governed_answer_invalid" }, { status: 400 });
    }
    // The learner may report only tools the issued ToolPolicy permits. Tool use
    // is provenance on admitted evidence, never a scoring input.
    const binding = release.bindings.find((candidate) => candidate.itemId === item.id && candidate.itemVersion === item.version);
    const toolPolicy = release.toolPolicies.find((candidate) => candidate.id === binding?.toolPolicyId);
    const toolsUsed = [...new Set((body.toolsUsed as string[] | undefined) ?? [])];
    if (!toolPolicy || toolsUsed.some((tool) => !toolPolicy.allowed.includes(tool))) {
      return NextResponse.json({ error: "tool_not_permitted" }, { status: 400 });
    }
    const admission = admitEvidence({ idempotencyKey: session.sessionId, schoolId: user.schoolId!,
      authenticatedUserId: user.id, studentId: student.id, studentUserId: user.id,
      itemId: item.id, itemVersion: item.version, context: item.context,
      toolsUsed, hintsUsed: 0, aiAssisted: false, source: "ONLINE" }, {
      expectedSchoolId: user.schoolId!, expectedStudentId: student.id, expectedStudentUserId: user.id, serverScored: true,
    }, release);
    if (admission.decision !== "ACCEPTED") return NextResponse.json({ error: admission.reason }, { status: 409 });
    const mastery = await appendCanonicalMasteryUpdate({ release, schoolId: user.schoolId!, studentId: student.id,
      studentUserId: user.id, sessionId: session.sessionId, itemId: item.id, itemVersion: item.version,
      selectedAnswerIndex: body.answerIndex as number, occurredAt: new Date().toISOString(), admission });
    // A replayed decision keeps its first sealed attempt; scoring the replay
    // would let a learner probe the answer key without generating evidence.
    if (mastery.duplicate) return NextResponse.json({ error: "attempt_already_recorded" }, { status: 409 });
    return NextResponse.json({ correct: body.answerIndex === item.correctIndex, duplicate: false,
      learnerState: toLearnerSafeStudentConceptState(mastery.update.state), nextActionHref: "/student/today",
      support: { hint: item.hint ?? null, workedExample: item.workedExample ?? null } });
  } catch (error) { return failure(error); }
}
