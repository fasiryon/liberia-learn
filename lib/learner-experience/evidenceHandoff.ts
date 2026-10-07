/**
 * Governed evidence handoff for Lesson Player V2.
 *
 * The lesson and the lab produce observations; they never score mastery items,
 * never write mastery and never choose the next lesson. The envelope is handed
 * to the existing authority chain:
 *
 *   Evidence → Student Learning Model → DecisionModel → Learning Orchestrator
 *
 * Disposition is decided by governance, not by the client: anything from a
 * prototype lesson, an unapproved link or an unreleased lab is RAW_OBSERVATION.
 */
import type { GovernedEvidenceType } from "@/lib/learning-evidence/evidenceContract";
import type { LessonExperience } from "./types";
import type { LearningExperienceLink } from "./links";
import type { ExperienceProgress } from "./progress";

export const EXPERIENCE_EVIDENCE_ENVELOPE_VERSION = "experience-evidence-envelope/1.0.0" as const;

export type ObservationDisposition = "RAW_OBSERVATION" | "PROVISIONAL" | "SUBMIT_TO_ASSESSMENT_AUTHORITY";

export type ExperienceObservation = Readonly<{
  observationId: string;
  sceneId: string;
  kind: "FORMATIVE_OBSERVATION" | "LAB_OBSERVATION" | "REFLECTION" | "MASTERY_RESPONSE";
  evidenceType: GovernedEvidenceType;
  objectiveIds: readonly string[];
  activity: Readonly<{ activityId: string; activityVersion: string }>;
  /** Learner responses as given. Mastery responses carry no correctness: the server scores them. */
  payload: Readonly<Record<string, unknown>>;
  disposition: ObservationDisposition;
}>;

export type ExperienceEvidenceEnvelope = Readonly<{
  contractVersion: typeof EXPERIENCE_EVIDENCE_ENVELOPE_VERSION;
  experienceId: string;
  experienceVersion: string;
  authorityStatus: LessonExperience["authority"]["status"];
  linkStatus: LearningExperienceLink["status"] | null;
  observations: readonly ExperienceObservation[];
  /** Invariants carried on the wire so every consumer can assert them. */
  masteryMutation: false;
  nextActionAuthority: "LEARNING_ORCHESTRATOR";
}>;

/** Governance decides disposition. The client cannot upgrade it. */
export function observationDisposition(
  kind: ExperienceObservation["kind"],
  experience: LessonExperience,
  link: LearningExperienceLink | null,
): ObservationDisposition {
  if (experience.authority.status !== "APPROVED_RELEASE") return "RAW_OBSERVATION";
  if (kind === "LAB_OBSERVATION") return link?.status === "APPROVED" ? "PROVISIONAL" : "RAW_OBSERVATION";
  if (kind === "MASTERY_RESPONSE") return "SUBMIT_TO_ASSESSMENT_AUTHORITY";
  return "PROVISIONAL";
}

export function buildEvidenceEnvelope(experience: LessonExperience, progress: ExperienceProgress, link: LearningExperienceLink | null): ExperienceEvidenceEnvelope {
  const observations: ExperienceObservation[] = [];
  const activity = { activityId: experience.id, activityVersion: experience.version };
  for (const scene of experience.scenes) {
    if (scene.evidence.kind === "NONE") continue;
    const responses = progress.responses[scene.id] ?? {};
    const base = { sceneId: scene.id, kind: scene.evidence.kind, evidenceType: scene.evidence.evidenceType, objectiveIds: scene.evidence.objectiveIds, disposition: observationDisposition(scene.evidence.kind, experience, link) };
    const id = `${experience.id}@${experience.version}:${scene.id}`;
    if (scene.evidence.kind === "LAB_OBSERVATION") {
      const observation = progress.lab.observation;
      if (!observation && progress.lab.status !== "FALLBACK_USED") continue;
      observations.push({ ...base, observationId: id, activity: observation ? { activityId: observation.labId, activityVersion: observation.labVersion } : activity, payload: observation ? { ...observation } : { fallbackUsed: true } });
      continue;
    }
    if (Object.keys(responses).length === 0) continue;
    if (scene.evidence.kind === "FORMATIVE_OBSERVATION" && scene.interaction.kind === "MULTIPLE_CHOICE") {
      // Formative feedback was shown locally; it is reported as an observation, never as a score.
      const items = scene.interaction.items.map((item) => ({ itemId: item.id, selectedIndex: responses[item.id] ?? null, matchedFormativeKey: responses[item.id] === item.correctIndex }));
      observations.push({ ...base, observationId: id, activity, payload: { items, serverScored: false } });
    } else if (scene.evidence.kind === "MASTERY_RESPONSE" && scene.interaction.kind === "ASSESSMENT_HANDOFF") {
      const { assessment } = scene.interaction;
      observations.push({ ...base, observationId: id, activity: { activityId: assessment.assessmentId, activityVersion: assessment.assessmentVersion }, payload: { player: assessment.player, responses: assessment.items.map((item) => ({ itemId: item.itemId, itemVersion: item.itemVersion, selectedAnswerIndex: responses[item.itemId] ?? null })) } });
    } else if (scene.evidence.kind === "REFLECTION") {
      observations.push({ ...base, observationId: id, activity, payload: { responses: { ...responses } } });
    }
  }
  return { contractVersion: EXPERIENCE_EVIDENCE_ENVELOPE_VERSION, experienceId: experience.id, experienceVersion: experience.version, authorityStatus: experience.authority.status, linkStatus: link?.status ?? null, observations, masteryMutation: false, nextActionAuthority: "LEARNING_ORCHESTRATOR" };
}
