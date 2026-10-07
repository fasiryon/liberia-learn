/**
 * LearningExperienceLink: the governed relationship that attaches a lab (or
 * other experience) to a lesson because it supports a specific objective —
 * replacing subject + grade matching in lib/lessons/labLinks.ts as the future
 * curricular authority.
 *
 * Adding a link never creates curriculum approval. Only a link whose status is
 * APPROVED, whose lesson is an APPROVED_RELEASE and whose lab is RELEASED may
 * be shown to real students.
 */
import type { LessonExperience } from "./types";
import type { LabExperience } from "./labExperience";

export const LEARNING_EXPERIENCE_LINK_VERSION = "learning-experience-link/1.0.0" as const;

export type LinkStatus = "APPROVED" | "PROTOTYPE_INTERNAL" | "CANDIDATE";

export type LearningExperienceLink = Readonly<{
  contractVersion: typeof LEARNING_EXPERIENCE_LINK_VERSION;
  linkId: string;
  status: LinkStatus;
  /** Who established the link and on what basis. Prototype links name no curriculum authority. */
  authority: Readonly<{ basis: string; approvedBy: string | null; approvedAt: string | null }>;
  lesson: Readonly<{ experienceId: string; experienceVersion: string }>;
  objectiveIds: readonly string[];
  experience: Readonly<{ kind: "INTERACTIVE_LAB" | "LEGACY_LAB" | "PRACTICAL_LAB"; labId: string; labVersion: string }>;
  placement: Readonly<{ sceneId: string }>;
  requirement: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  preLab: Readonly<{ sceneIds: readonly string[] }>;
  postLab: Readonly<{ reflectionSceneId: string | null; checkSceneId: string | null }>;
  /** How lab observations map to lesson objectives. The lab never writes mastery itself. */
  evidenceMapping: readonly Readonly<{ labCheckId: string; objectiveId: string; disposition: "RAW_OBSERVATION" | "PROVISIONAL" | "CANONICAL_WHEN_RELEASED" }>[];
}>;

export class ExperienceLinkError extends Error {}

/** Structural validation of a link against the lesson and lab it joins. */
export function validateExperienceLink(link: LearningExperienceLink, lesson: LessonExperience, lab: LabExperience): void {
  const fail = (code: string) => { throw new ExperienceLinkError(code); };
  if (link.contractVersion !== LEARNING_EXPERIENCE_LINK_VERSION) fail("link_contract_unsupported");
  if (link.lesson.experienceId !== lesson.id || link.lesson.experienceVersion !== lesson.version) fail("link_lesson_identity_mismatch");
  if (link.experience.labId !== lab.labId || link.experience.labVersion !== lab.version) fail("link_lab_identity_mismatch");
  if (link.objectiveIds.length === 0) fail("link_objectives_required");
  const lessonObjectives = new Set(lesson.objectives.map((objective) => objective.id));
  for (const objectiveId of link.objectiveIds) {
    if (!lessonObjectives.has(objectiveId)) fail("link_objective_not_in_lesson");
    // The lab must claim to support the objective: no attachment by subject or grade alone.
    if (!lab.objectiveIds.includes(objectiveId)) fail("link_objective_not_supported_by_lab");
  }
  const scene = lesson.scenes.find((candidate) => candidate.id === link.placement.sceneId);
  if (!scene || scene.type !== "LAB" || scene.interaction.kind !== "LAB_LAUNCH" || scene.interaction.linkId !== link.linkId) fail("link_placement_invalid");
  const sceneIndex = lesson.scenes.findIndex((candidate) => candidate.id === link.placement.sceneId);
  const indexOf = (id: string) => lesson.scenes.findIndex((candidate) => candidate.id === id);
  for (const id of link.preLab.sceneIds) if (indexOf(id) < 0 || indexOf(id) >= sceneIndex) fail("link_pre_lab_scene_invalid");
  for (const id of [link.postLab.reflectionSceneId, link.postLab.checkSceneId]) if (id && indexOf(id) <= sceneIndex) fail("link_post_lab_scene_invalid");
  for (const mapping of link.evidenceMapping) if (!link.objectiveIds.includes(mapping.objectiveId)) fail("link_evidence_objective_invalid");
  if (link.status === "APPROVED" && (!link.authority.approvedBy || !link.authority.approvedAt)) fail("link_approval_provenance_required");
  if (link.status !== "APPROVED" && link.evidenceMapping.some((mapping) => mapping.disposition === "CANONICAL_WHEN_RELEASED")) fail("link_unapproved_canonical_mapping");
}

/**
 * Whether a real student may follow this link. Everything else (prototype,
 * candidate, draft lab, unreleased lesson) is internal-only.
 */
export function isLinkStudentVisible(link: LearningExperienceLink, lesson: LessonExperience, lab: LabExperience): boolean {
  return link.status === "APPROVED" && lesson.authority.status === "APPROVED_RELEASE" && lab.release.status === "RELEASED";
}
