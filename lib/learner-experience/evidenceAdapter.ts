/**
 * Server-side adapter from a Lesson Player V2 evidence envelope to the existing
 * governed evidence contract. It only constructs and classifies evidence; it
 * never calls the mastery writer, the Student Learning Model or the
 * Learning Orchestrator. Admission into those systems stays with their own
 * routes and policies.
 */
import { createGovernedEvidence, validateGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import { adaptLabEvidence } from "@/lib/interactive-labs/v2/governance";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import type { ExperienceEvidenceEnvelope, ExperienceObservation, ObservationDisposition } from "./evidenceHandoff";

export type AdaptedObservation = Readonly<{
  observationId: string;
  disposition: ObservationDisposition;
  evidence: readonly GovernedEvidence[];
  reason: string;
}>;

type Learner = Readonly<{ tenantId: string; schoolId: string; studentId: string; studentUserId: string; sessionId: string }>;

function governed(observation: ExperienceObservation, envelope: ExperienceEvidenceEnvelope, learner: Learner, occurredAt: string, suffix = "", objectiveId?: string, conceptId?: string): GovernedEvidence {
  const key = `${learner.sessionId}:${observation.observationId}${suffix}`;
  return createGovernedEvidence({
    evidenceId: `lx-${key}`,
    idempotencyKey: key,
    attemptId: `${learner.sessionId}:${observation.sceneId}`,
    tenantId: learner.tenantId,
    schoolId: learner.schoolId,
    learner: { studentId: learner.studentId, studentUserId: learner.studentUserId },
    objective: { objectiveId: objectiveId ?? observation.objectiveIds[0], conceptId: conceptId ?? observation.objectiveIds[0] },
    activity: observation.activity,
    evidenceType: observation.evidenceType,
    modality: observation.kind === "LAB_OBSERVATION" ? "LAB_RUNTIME" : "INTERACTIVE",
    occurredAt,
    // Lesson-side observations are never scored here: mastery items go to the assessment authority.
    performance: { outcome: "OBSERVED", score: null, maxScore: null, correct: null, signals: [], payload: observation.payload },
    provenance: { source: "ONLINE", actorId: learner.studentUserId, actorRole: "STUDENT", runtime: observation.kind === "LAB_OBSERVATION" ? "LAB" : "WEB", recordedAt: occurredAt, clientEventId: null, syncBatchId: null },
    strength: { serverScored: false, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: learner.sessionId, directness: "INDIRECT", reliability: "UNASSESSED", policyRef: `lesson-experience:${envelope.experienceId}@${envelope.experienceVersion}` },
    offline: { isOffline: false, syncIdentity: null },
    curriculum: { ontologyReleaseId: envelope.authorityStatus === "APPROVED_RELEASE" ? envelope.experienceId : "unreleased", ontologyReleaseIdentity: envelope.experienceVersion },
  });
}

export function adaptEnvelope(envelope: ExperienceEvidenceEnvelope, learner: Learner, occurredAt = new Date().toISOString()): AdaptedObservation[] {
  if (envelope.masteryMutation !== false || envelope.nextActionAuthority !== "LEARNING_ORCHESTRATOR") throw new Error("experience_envelope_invariant_violated");
  return envelope.observations.map((observation) => {
    if (observation.kind !== "LAB_OBSERVATION") {
      const evidence = governed(observation, envelope, learner, occurredAt);
      validateGovernedEvidence(evidence);
      return { observationId: observation.observationId, disposition: observation.disposition, evidence: [evidence], reason: observation.disposition === "RAW_OBSERVATION" ? "Lesson is not an approved release; recorded as observation only." : "Routed to existing evidence admission." };
    }
    // Lab checks go through the existing lab governance, which knows whether a check has authority.
    const definition = getInteractiveLabDefinition(observation.activity.activityId);
    const checkIds = Array.isArray(observation.payload.completedCheckIds) ? (observation.payload.completedCheckIds as string[]) : [];
    const evidence: GovernedEvidence[] = [];
    let disposition: ObservationDisposition = observation.disposition;
    let reason = "Lab fallback used; no runtime observations.";
    for (const checkId of checkIds) {
      const check = definition?.checks.find((candidate) => candidate.id === checkId);
      if (!definition || !check) continue;
      const item = governed(observation, envelope, learner, occurredAt, `:${checkId}`, check.objectiveId, check.conceptId);
      const adapted = adaptLabEvidence({ definition, check, evidence: item });
      evidence.push(adapted.governedEvidence);
      reason = adapted.reason;
      // The stricter of governance's answer and the envelope's disposition wins.
      if (adapted.disposition === "RAW_OBSERVATION") disposition = "RAW_OBSERVATION";
    }
    return { observationId: observation.observationId, disposition, evidence, reason };
  });
}
