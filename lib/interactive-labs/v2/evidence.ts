import { createHash } from "crypto";
import { createGovernedEvidence, validateGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import type { InteractiveLabDefinition, LabState, LearningCheck } from "./types";

export function evaluateCheck(check: LearningCheck, state: LabState, response: Record<string, unknown>): { correct: boolean; signals: { code: string; value: "PRESENT" | "ABSENT"; detail?: string }[] } {
  let correct = false;
  if (check.kind === "select") correct = state.selectedObjectId === check.answer.objectId;
  if (check.kind === "manipulate") correct = state.rotations[String(check.answer.objectId)]?.[1] !== 0;
  if (check.kind === "feature") correct = (state.highlightedFeatures[String(check.answer.objectId)]?.indices.length ?? 0) >= Number(check.answer.count ?? 0);
  if (check.kind === "compare") correct = JSON.stringify(response.objects) === JSON.stringify(check.answer.objects);
  return { correct, signals: [{ code: `lab.check.${check.id}`, value: correct ? "PRESENT" : "ABSENT" }] };
}

export function buildLabEvidence(input: { definition: InteractiveLabDefinition; check: LearningCheck; state: LabState; response: Record<string, unknown>; tenantId: string; schoolId: string; studentId: string; studentUserId: string; sessionId: string; retryCount: number; hintCount: number; occurredAt?: string }): GovernedEvidence {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const evaluated = evaluateCheck(input.check, input.state, input.response);
  const idempotencyKey = `${input.sessionId}:${input.check.id}:${input.state.completedChecks.includes(input.check.id) ? "complete" : input.state.retries}`;
  const evidenceId = `lab-${createHash("sha256").update(idempotencyKey).digest("hex")}`;
  const evidence = createGovernedEvidence({
    evidenceId, idempotencyKey, attemptId: `${input.sessionId}:${input.check.id}`, tenantId: input.tenantId, schoolId: input.schoolId,
    learner: { studentId: input.studentId, studentUserId: input.studentUserId }, objective: { conceptId: input.check.conceptId, objectiveId: input.check.objectiveId },
    activity: { activityId: input.definition.id, activityVersion: input.definition.version }, evidenceType: "LAB", modality: "LAB_RUNTIME", occurredAt,
    performance: { outcome: evaluated.correct ? "CORRECT" : "INCORRECT", score: evaluated.correct ? 1 : 0, maxScore: 1, correct: evaluated.correct, ...(Number.isInteger(input.response.selectedAnswerIndex) ? { selectedAnswerIndex: Number(input.response.selectedAnswerIndex) } : {}), signals: evaluated.signals, payload: { response: input.response, completedChecks: input.state.completedChecks } },
    provenance: { source: "ONLINE", actorId: input.studentUserId, actorRole: "STUDENT", runtime: "LAB", recordedAt: occurredAt, clientEventId: null, syncBatchId: null },
    strength: { serverScored: true, humanVerified: false, assistanceUsed: input.hintCount > 0, retryCount: input.retryCount, hintCount: input.hintCount, independenceKey: input.sessionId, directness: "DIRECT", reliability: "UNASSESSED", policyRef: input.definition.releaseBinding.releaseId },
    offline: { isOffline: false, syncIdentity: null }, curriculum: { ontologyReleaseId: input.definition.releaseBinding.releaseId, ontologyReleaseIdentity: input.definition.releaseBinding.releaseIdentity },
  });
  validateGovernedEvidence(evidence);
  return evidence;
}
