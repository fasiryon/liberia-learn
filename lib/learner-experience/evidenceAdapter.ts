/**
 * Server-side adapter from a Lesson Player V2 evidence envelope to the existing
 * governed evidence contract. It only constructs and classifies evidence; it
 * never calls the mastery writer, the Student Learning Model or the
 * Learning Orchestrator. Admission into those systems stays with their own
 * routes and policies.
 *
 * The envelope comes from a learner device, so it is untrusted: authority,
 * disposition, evidence type, objectives and activity are recomputed from the
 * server's copy of the lesson and its links. The envelope supplies responses only.
 */
import { createGovernedEvidence, validateGovernedEvidence, type GovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import { adaptLabEvidence } from "@/lib/interactive-labs/v2/governance";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { observationDisposition, type ExperienceEvidenceEnvelope, type ExperienceObservation, type ObservationDisposition } from "./evidenceHandoff";
import type { LearningExperienceLink } from "./links";
import type { LessonExperience, Scene } from "./types";

export type AdaptedObservation = Readonly<{
  observationId: string;
  disposition: ObservationDisposition;
  evidence: readonly GovernedEvidence[];
  reason: string;
}>;

type Learner = Readonly<{ tenantId: string; schoolId: string; studentId: string; studentUserId: string; sessionId: string }>;
type ServerLesson = Readonly<{ experience: LessonExperience; links: readonly LearningExperienceLink[] }>;
type Trusted = Readonly<{ observationId: string; sceneId: string; kind: ExperienceObservation["kind"]; evidenceType: GovernedEvidence["evidenceType"]; objectiveIds: readonly string[]; activity: GovernedEvidence["activity"]; payload: Readonly<Record<string, unknown>>; disposition: ObservationDisposition }>;

function governed(observation: Trusted, lesson: LessonExperience, learner: Learner, occurredAt: string, suffix = "", objectiveId?: string, conceptId?: string): GovernedEvidence {
  const key = `${learner.sessionId}:${observation.observationId}${suffix}`;
  const concept = lesson.objectives.find((objective) => objective.id === observation.objectiveIds[0])?.conceptId ?? observation.objectiveIds[0];
  return createGovernedEvidence({
    evidenceId: `lx-${key}`,
    idempotencyKey: key,
    attemptId: `${learner.sessionId}:${observation.sceneId}`,
    tenantId: learner.tenantId,
    schoolId: learner.schoolId,
    learner: { studentId: learner.studentId, studentUserId: learner.studentUserId },
    objective: { objectiveId: objectiveId ?? observation.objectiveIds[0], conceptId: conceptId ?? concept },
    activity: observation.activity,
    evidenceType: observation.evidenceType,
    modality: observation.kind === "LAB_OBSERVATION" ? "LAB_RUNTIME" : "INTERACTIVE",
    occurredAt,
    // Lesson-side observations are never scored here: mastery items go to the assessment authority.
    performance: { outcome: "OBSERVED", score: null, maxScore: null, correct: null, signals: [], payload: observation.payload },
    provenance: { source: "ONLINE", actorId: learner.studentUserId, actorRole: "STUDENT", runtime: observation.kind === "LAB_OBSERVATION" ? "LAB" : "WEB", recordedAt: occurredAt, clientEventId: null, syncBatchId: null },
    strength: { serverScored: false, humanVerified: false, assistanceUsed: false, retryCount: 0, hintCount: 0, independenceKey: learner.sessionId, directness: "INDIRECT", reliability: "UNASSESSED", policyRef: `lesson-experience:${lesson.id}@${lesson.version}` },
    offline: { isOffline: false, syncIdentity: null },
    curriculum: { ontologyReleaseId: lesson.authority.status === "APPROVED_RELEASE" && lesson.authority.releaseId ? lesson.authority.releaseId : "unreleased", ontologyReleaseIdentity: lesson.version },
  });
}

/** Rebuild an observation from the server's lesson; anything the client claims beyond responses is ignored. */
function trust(observation: ExperienceObservation, server: ServerLesson): Trusted | null {
  const { experience } = server;
  const scene: Scene | undefined = experience.scenes.find((candidate) => candidate.id === observation.sceneId);
  if (!scene || scene.evidence.kind === "NONE" || scene.evidence.kind !== observation.kind) return null;
  const link = scene.interaction.kind === "LAB_LAUNCH" ? server.links.find((candidate) => candidate.linkId === (scene.interaction as { linkId: string }).linkId) ?? null : null;
  const activity = scene.evidence.kind === "LAB_OBSERVATION"
    ? link ? { activityId: link.experience.labId, activityVersion: link.experience.labVersion } : null
    : scene.interaction.kind === "ASSESSMENT_HANDOFF"
      ? { activityId: scene.interaction.assessment.assessmentId, activityVersion: scene.interaction.assessment.assessmentVersion }
      : { activityId: experience.id, activityVersion: experience.version };
  if (!activity) return null;
  return {
    observationId: `${experience.id}@${experience.version}:${scene.id}`,
    sceneId: scene.id, kind: scene.evidence.kind, evidenceType: scene.evidence.evidenceType, objectiveIds: scene.evidence.objectiveIds,
    activity, payload: observation.payload,
    disposition: observationDisposition(scene.evidence.kind, experience, link),
  };
}

export function adaptEnvelope(envelope: ExperienceEvidenceEnvelope, server: ServerLesson, learner: Learner, occurredAt = new Date().toISOString()): AdaptedObservation[] {
  if (envelope.masteryMutation !== false || envelope.nextActionAuthority !== "LEARNING_ORCHESTRATOR") throw new Error("experience_envelope_invariant_violated");
  if (envelope.experienceId !== server.experience.id || envelope.experienceVersion !== server.experience.version) throw new Error("experience_envelope_lesson_mismatch");
  const adapted: AdaptedObservation[] = [];
  for (const raw of envelope.observations) {
    const observation = trust(raw, server);
    if (!observation) continue;
    if (observation.kind !== "LAB_OBSERVATION") {
      const evidence = governed(observation, server.experience, learner, occurredAt);
      validateGovernedEvidence(evidence);
      adapted.push({ observationId: observation.observationId, disposition: observation.disposition, evidence: [evidence], reason: observation.disposition === "RAW_OBSERVATION" ? "Lesson is not an approved release; recorded as observation only." : "Routed to existing evidence admission." });
      continue;
    }
    // Lab checks go through the existing lab governance, which knows whether a check has authority.
    const definition = getInteractiveLabDefinition(observation.activity.activityId);
    const checkIds = Array.isArray(observation.payload.completedCheckIds) ? (observation.payload.completedCheckIds as unknown[]).filter((id): id is string => typeof id === "string") : [];
    const evidence: GovernedEvidence[] = [];
    let disposition: ObservationDisposition = observation.disposition;
    let reason = "Lab fallback used; no runtime observations.";
    for (const checkId of checkIds) {
      const check = definition?.checks.find((candidate) => candidate.id === checkId);
      if (!definition || !check) continue;
      const item = governed(observation, server.experience, learner, occurredAt, `:${checkId}`, check.objectiveId, check.conceptId);
      const result = adaptLabEvidence({ definition, check, evidence: item });
      evidence.push(result.governedEvidence);
      reason = result.reason;
      // The stricter of lab governance and lesson governance wins.
      if (result.disposition === "RAW_OBSERVATION") disposition = "RAW_OBSERVATION";
    }
    adapted.push({ observationId: observation.observationId, disposition, evidence, reason });
  }
  return adapted;
}
