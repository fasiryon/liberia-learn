/**
 * Server-resolved lab links for Curriculum V2 (Codex P1-6).
 *
 * A generator may only *propose* a lab. Everything that matters is resolved here from trusted
 * registries — the real lab id and version, release status, the lab's actual checks, its
 * objective mapping, grade band and prerequisites — and nothing the generator claims about
 * approval, release, checks or eligibility is believed. The resulting LearningExperienceLink is
 * always CANDIDATE: generation can never grant release or approval. Mount Coffee and every other
 * unreleased lab stay student-ineligible.
 */
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { findLabExperience, gradeInBand, type LabExperience } from "@/lib/learner-experience/labExperience";
import { LEARNING_EXPERIENCE_LINK_VERSION, type LearningExperienceLink } from "@/lib/learner-experience/links";
import type { AuthoringContext } from "./authoringContext";
import type { CandidateLabProposal, CandidateScene, LabEligibility, ResolvedLabLink } from "./contract";

export class LabProposalError extends Error {
  constructor(readonly code: string, readonly proposalId: string) {
    super(`${code}:${proposalId}`);
    this.name = "LabProposalError";
  }
}

export function resolveLabProposal(input: {
  proposal: CandidateLabProposal;
  scenes: readonly CandidateScene[];
  lesson: Readonly<{ lessonId: string; version: string }>;
  context: AuthoringContext;
}): ResolvedLabLink {
  const { proposal, context } = input;
  const fail = (code: string): never => { throw new LabProposalError(code, proposal.id); };
  const lab = findLabExperience(proposal.labId);
  if (!lab) fail("lab_unknown");
  const resolved = lab as LabExperience;
  if (!context.objectives.some((objective) => objective.id === proposal.objectiveId)) fail("lab_objective_not_in_lesson");
  // The lab must itself claim the objective: no attachment by subject, grade or title.
  if (!resolved.objectiveIds.includes(proposal.objectiveId)) fail("lab_objective_not_supported_by_lab");
  if (resolved.gradeBands.length && !resolved.gradeBands.some((band) => gradeInBand(context.grade, band))) fail("lab_grade_incompatible");
  const knownConcepts = new Set([...context.concepts.map((concept) => concept.id), ...context.prerequisiteConceptIds]);
  if (resolved.prerequisites.some((prerequisite) => !knownConcepts.has(prerequisite))) fail("lab_prerequisites_unmet");

  const scene = input.scenes.find((candidate) => candidate.id === proposal.placementSceneId);
  if (!scene || scene.type !== "LAB" || scene.interaction.kind !== "LAB_LAUNCH" || scene.interaction.labCandidateId !== proposal.id) fail("lab_placement_invalid");

  // Checks come from the lab's own definition; invented or mismatched check ids are rejected.
  const definition = resolved.runtime.kind === "INTERACTIVE_V2" ? getInteractiveLabDefinition(resolved.labId) : null;
  const actualChecks = definition?.checks ?? [];
  for (const checkId of proposal.checkIds) {
    const check = actualChecks.find((candidate) => candidate.id === checkId);
    if (!check) fail("lab_check_unknown");
    if (check!.objectiveId !== proposal.objectiveId) fail("lab_check_objective_mismatch");
  }
  const mappedChecks = (proposal.checkIds.length ? proposal.checkIds : actualChecks.filter((check) => check.objectiveId === proposal.objectiveId).map((check) => check.id));

  const index = input.scenes.findIndex((candidate) => candidate.id === scene!.id);
  const preLab = input.scenes.slice(0, index).filter((candidate) => candidate.type === "CHECK_UNDERSTANDING" || candidate.type === "INTERACTIVE_DIAGRAM" || candidate.type === "GUIDED_EXAMPLE").map((candidate) => candidate.id);
  const after = input.scenes.slice(index + 1);
  const link: LearningExperienceLink = {
    contractVersion: LEARNING_EXPERIENCE_LINK_VERSION,
    linkId: `${input.lesson.lessonId}--${proposal.id}`,
    status: "CANDIDATE",
    authority: { basis: "Curriculum V2 generated proposal, resolved against the lab registry. Not curriculum approval.", approvedBy: null, approvedAt: null },
    lesson: { experienceId: input.lesson.lessonId, experienceVersion: input.lesson.version },
    objectiveIds: [proposal.objectiveId],
    experience: { kind: resolved.runtime.kind === "INTERACTIVE_V2" ? "INTERACTIVE_LAB" : resolved.runtime.kind === "PRACTICAL_GUIDED" ? "PRACTICAL_LAB" : "LEGACY_LAB", labId: resolved.labId, labVersion: resolved.version },
    placement: { sceneId: scene!.id },
    requirement: proposal.requirement,
    preLab: { sceneIds: preLab },
    postLab: { reflectionSceneId: after.find((candidate) => candidate.type === "REFLECTION")?.id ?? null, checkSceneId: after.find((candidate) => candidate.type === "MASTERY_CHECK")?.id ?? null },
    // A candidate can never map to canonical evidence; dispositions upgrade only through governance.
    evidenceMapping: mappedChecks.map((labCheckId) => ({ labCheckId, objectiveId: proposal.objectiveId, disposition: "RAW_OBSERVATION" as const })),
  };
  return { link, proposalId: proposal.id, rationale: proposal.rationale, eligibility: labLinkEligibility({ link, lab: resolved, learnerGrade: context.grade, lessonApproved: false }) };
}

/**
 * Student eligibility for a lesson lab link in governed context. Every condition must hold;
 * reasons explain each failure for reviewers.
 */
export function labLinkEligibility(input: { link: LearningExperienceLink; lab: LabExperience | null; learnerGrade: number | null; lessonApproved: boolean }): LabEligibility {
  const reasons: string[] = [];
  if (!input.lab) reasons.push("LAB_UNKNOWN");
  if (input.link.status !== "APPROVED") reasons.push(`LINK_${input.link.status}`);
  if (!input.lessonApproved) reasons.push("LESSON_NOT_APPROVED");
  if (input.lab && input.lab.release.status !== "RELEASED") reasons.push(`LAB_NOT_RELEASED:${input.lab.release.reviewState}/${input.lab.release.approvalState}`);
  if (input.lab && input.lab.labId !== input.link.experience.labId) reasons.push("LAB_IDENTITY_MISMATCH");
  if (input.lab && input.lab.version !== input.link.experience.labVersion) reasons.push("LAB_VERSION_MISMATCH");
  if (input.lab && input.learnerGrade !== null && input.lab.gradeBands.length && !input.lab.gradeBands.some((band) => gradeInBand(input.learnerGrade, band))) reasons.push("LAB_GRADE_INCOMPATIBLE");
  return { studentEligible: reasons.length === 0, reasons };
}
