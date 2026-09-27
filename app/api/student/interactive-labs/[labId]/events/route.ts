// route-policy: auth=session; scope=record; authority=student-session-ownership-and-governed-release; rationale=interactive lab events are server-validated against the authenticated learner's tenant-bound session and an approved released definition
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { acceptLabAction, checkpointSession, restoreSession } from "@/lib/interactive-labs/v2/kernel";
import { buildLabEvidence } from "@/lib/interactive-labs/v2/evidence";
import { validateGovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import { adaptLabEvidence } from "@/lib/interactive-labs/v2/governance";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { labId: string } }) {
  try {
    const user = await requireRole("STUDENT"); const definition = getInteractiveLabDefinition(params.labId); if (!definition) return NextResponse.json({ error: "unknown_lab" }, { status: 404 });
    const body = await req.json(); const preview = body?.mode === "PREVIEW"; if ((definition.reviewState !== "APPROVED" || definition.approvalState !== "APPROVED") && !preview) return NextResponse.json({ error: "lab_not_governed" }, { status: 409 });
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : ""; if (!sessionId) return NextResponse.json({ error: "session_required" }, { status: 400 });
    const session = await prisma.labSession.findFirst({ where: { id: sessionId, labId: params.labId, studentId: user.id, schoolId: user.schoolId ?? "" } }); if (!session) return NextResponse.json({ error: "session_scope_invalid" }, { status: 403 });
    const stored = restoreSession(session.observations, definition); if (session.observations && !stored) return NextResponse.json({ error: "stale_or_corrupt_checkpoint" }, { status: 409 });
    const state = stored?.state ?? definition.initialState; const action = body?.action; const result = acceptLabAction(definition, state, action); if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
    const nextState = result.state; const checkpoint = checkpointSession({ sessionId, labId: definition.id, labVersion: definition.version, learnerId: user.id, tenantId: user.schoolId ?? "", mode: nextState.mode, completedChecks: nextState.completedChecks, retries: nextState.retries, hints: nextState.hints, state: nextState });
    await prisma.labSession.update({ where: { id: sessionId }, data: { observations: checkpoint } });
    if (action?.type !== "check") return NextResponse.json({ ok: true, state: nextState });
    const check = definition.checks.find((candidate) => candidate.id === action.checkId); if (!check) return NextResponse.json({ error: "check_unknown" }, { status: 422 });
    const evidence = buildLabEvidence({ definition, check, state: nextState, response: action.response ?? {}, tenantId: user.schoolId ?? "", schoolId: user.schoolId ?? "", studentId: user.id, studentUserId: user.id, sessionId, retryCount: nextState.retries, hintCount: nextState.hints }); validateGovernedEvidence(evidence);
    const priorAnalysis = session.aiAnalysis && typeof session.aiAnalysis === "object" && !Array.isArray(session.aiAnalysis) ? session.aiAnalysis as Record<string, unknown> : {};
    const priorEvidence = Array.isArray(priorAnalysis.interactiveLabEvidence) ? priorAnalysis.interactiveLabEvidence as Array<Record<string, unknown>> : [];
    const prior = priorEvidence.find((candidate) => candidate.idempotencyKey === evidence.idempotencyKey);
    if (prior && JSON.stringify(prior) !== JSON.stringify(evidence)) return NextResponse.json({ error: "evidence_idempotency_conflict" }, { status: 409 });
    if (!prior) await prisma.labSession.update({ where: { id: sessionId }, data: { aiAnalysis: { ...priorAnalysis, interactiveLabEvidence: [...priorEvidence, evidence] } } });
    const adaptation = adaptLabEvidence({ definition, check, evidence });
    return NextResponse.json({ ok: true, state: nextState, evidence: adaptation.governedEvidence, evidenceDisposition: preview ? "RAW_OBSERVATION" : adaptation.disposition, mastery: "not_mutated", reason: adaptation.reason });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "interactive_lab_event_failed" }, { status: 500 }); }
}
