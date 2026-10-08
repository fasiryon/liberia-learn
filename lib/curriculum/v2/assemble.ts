/**
 * Assemble a CurriculumLessonV2 artifact from a parsed candidate and trusted authoring context.
 *
 * All authority is constructed here from server state: objective meaning, ontology, release
 * identity, lab links, provenance and governance. The governance block is a constant DRAFT
 * requiring human review; there is no code path that assembles anything else.
 */
import { createHash } from "crypto";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import type { AuthoringContext } from "./authoringContext";
import { CURRICULUM_LESSON_V2_CONTRACT, type CandidateLessonV2, type CurriculumLessonV2, type ResolvedAssessmentHandoff, type ResolvedLabLink, type ReviewGap } from "./contract";
import { deliverabilityGaps, sceneDeliverability, type LabRuntime, type SceneDeliverability } from "./deliverability";
import { LabProposalError, resolveLabProposal } from "./labs";
import { validateCandidateAgainstContext } from "./validate";
import { scanCandidate } from "./parse";

export const CURRICULUM_V2_GENERATOR = Object.freeze({ name: "curriculum-v2-assembler", version: "1.0.0" });

export type GenerationMetadata = Readonly<{
  origin: CurriculumLessonV2["provenance"]["origin"];
  promptKey: string | null;
  promptVersion: string | null;
  promptHash: string | null;
  model: string | null;
  generatedAt: string;
  migration?: CurriculumLessonV2["provenance"]["migration"];
}>;

export type AssemblyOutcome =
  | Readonly<{ status: "REJECTED"; errors: readonly string[]; gaps: readonly ReviewGap[] }>
  | Readonly<{ status: "REVIEW_BLOCKED" | "READY_FOR_HUMAN_REVIEW"; lesson: CurriculumLessonV2; deliverability: readonly SceneDeliverability[] }>;

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

export function lessonIdFor(context: AuthoringContext): string {
  const primary = context.objectives[0].id.replace(/^moe-/, "");
  return `cv2-${primary}`.slice(0, 120);
}

export function assembleCurriculumLessonV2(input: { candidate: CandidateLessonV2; context: AuthoringContext; generation: GenerationMetadata; version?: string }): AssemblyOutcome {
  const { candidate, context } = input;
  const validation = validateCandidateAgainstContext(candidate, context);
  const errors = [...validation.errors];
  const lessonId = lessonIdFor(context);
  const version = input.version ?? "0.1.0";

  // Labs: proposals are resolved against the registries; a proposal that does not resolve rejects the artifact.
  const labLinks: ResolvedLabLink[] = [];
  for (const proposal of candidate.labProposals) {
    try { labLinks.push(resolveLabProposal({ proposal, scenes: candidate.scenes, lesson: { lessonId, version }, context })); }
    catch (error) { errors.push(error instanceof LabProposalError ? error.message : `lab_resolution_failed:${proposal.id}`); }
  }

  // Assessment handoffs reference governed release items for the objectives' concepts; keys stay in the release.
  const assessmentHandoffs: ResolvedAssessmentHandoff[] = candidate.assessmentRequests.map((request) => {
    const conceptIds = new Set(context.objectives.filter((objective) => request.objectiveIds.includes(objective.id)).flatMap((objective) => objective.conceptIds));
    return {
      requestId: request.id, player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: request.objectiveIds,
      interaction: request.interaction, evidenceType: request.evidenceType, difficulty: request.difficulty, misconceptionIds: request.misconceptionIds,
      tools: { allowed: request.tools.requested.filter((tool) => !request.tools.prohibited.includes(tool)), prohibited: request.tools.prohibited }, offline: request.offline,
      governedItems: context.governedItems.filter((item) => conceptIds.has(item.conceptId)).map(({ itemId, itemVersion, prompt, options }) => ({ itemId, itemVersion, prompt, options })),
    };
  });

  if (errors.length) return { status: "REJECTED", errors: [...new Set(errors)], gaps: validation.gaps };

  const deliverability = candidate.scenes.map((scene) => {
    let lab: LabRuntime | null = null;
    if (scene.interaction.kind === "LAB_LAUNCH") {
      const resolved = labLinks.find((entry) => entry.proposalId === (scene.interaction as { labCandidateId: string }).labCandidateId) ?? null;
      const experience = resolved ? findLabExperience(resolved.link.experience.labId) : null;
      const definition = experience?.runtime.kind === "INTERACTIVE_V2" ? getInteractiveLabDefinition(experience.labId) : null;
      lab = {
        lab: experience, studentEligible: resolved?.eligibility.studentEligible ?? false,
        keyboard: definition?.accessibility.keyboard ?? false, reducedMotion: definition?.accessibility.reducedMotion ?? false,
        offline: experience?.offline.offlineCapable ?? false, hasFallback2D: definition?.accessibility.fallback === "FALLBACK_2D",
      };
    }
    const handoff = scene.interaction.kind === "ASSESSMENT_HANDOFF" ? assessmentHandoffs.find((entry) => entry.requestId === (scene.interaction as { assessmentRequestId: string }).assessmentRequestId) : null;
    return sceneDeliverability(scene, lab, !!handoff && handoff.governedItems.length > 0);
  });

  const reviewGaps: ReviewGap[] = [
    ...context.gaps,
    ...validation.gaps,
    ...deliverabilityGaps(deliverability),
    ...labLinks.filter((entry) => !entry.eligibility.studentEligible).map((entry): ReviewGap => ({ code: "LAB_LINK_CANDIDATE_ONLY", severity: "ADVISORY", sceneId: entry.link.placement.sceneId, detail: `${entry.link.experience.labId} is a candidate link (${entry.eligibility.reasons.join(", ")}); learners get the scene fallback.` })),
    ...assessmentHandoffs.filter((handoff) => handoff.governedItems.length === 0).map((handoff): ReviewGap => ({ code: "ASSESSMENT_ITEMS_PENDING", severity: "BLOCKING", detail: `${handoff.requestId} has no governed items for ${handoff.objectiveIds.join(", ")}; Assessment Player V2 items must be authored and released.` })),
  ];

  const lesson: CurriculumLessonV2 = {
    contractVersion: CURRICULUM_LESSON_V2_CONTRACT,
    identity: { lessonId, version, title: candidate.title, grade: context.grade, subject: context.subject, unitId: context.objectives[0].unitId },
    authoring: { releaseId: context.release.id, releaseIdentity: context.release.identity, cellId: context.cell.id, cellVersion: context.cell.version, contextHash: context.contextHash, source: context.source },
    ageBand: candidate.ageBand,
    estimatedMinutes: candidate.estimatedMinutes,
    pedagogy: candidate.pedagogy ?? null,
    objectives: context.objectives,
    prerequisites: { conceptIds: context.prerequisiteConceptIds, assumptions: candidate.prerequisiteAssumptions },
    misconceptions: candidate.misconceptions,
    scenes: candidate.scenes,
    assessmentHandoffs,
    labLinks,
    provenance: {
      generatorName: CURRICULUM_V2_GENERATOR.name,
      generatorVersion: CURRICULUM_V2_GENERATOR.version,
      candidateSha256: sha256(candidate),
      origin: input.generation.origin,
      promptKey: input.generation.promptKey,
      promptVersion: input.generation.promptVersion,
      promptHash: input.generation.promptHash,
      model: input.generation.model,
      generatedAt: input.generation.generatedAt,
      migration: input.generation.migration ?? null,
    },
    governance: { state: "DRAFT", humanReviewRequired: true, published: false, moeApprovalState: "NOT_CLAIMED", requiredApprovalBasis: "HUMAN_REVIEW" },
    reviewGaps,
  };

  // Defence in depth: no secret field may exist in learner-bound content (scenes, notes, governed item refs).
  const leaked = scanCandidate({ scenes: lesson.scenes, misconceptions: lesson.misconceptions, governedItems: lesson.assessmentHandoffs.map((handoff) => handoff.governedItems) }).filter((issue) => issue.startsWith("secret"));
  if (leaked.length) return { status: "REJECTED", errors: leaked, gaps: reviewGaps };

  return { status: reviewGaps.some((gap) => gap.severity === "BLOCKING") ? "REVIEW_BLOCKED" : "READY_FOR_HUMAN_REVIEW", lesson, deliverability };
}
