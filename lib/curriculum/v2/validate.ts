/**
 * Deterministic Curriculum V2 validation and quality gates.
 *
 * ERRORS reject the artifact outright (invalid references, broken structure, leaked secrets,
 * contradictory ordering). GAPS are kept on the artifact for the human reviewer: BLOCKING gaps
 * mean it cannot be approved for students as it stands; ADVISORY gaps need a reviewer's eye.
 * Static checks cannot judge pedagogy: they catch structural failure, not teaching quality.
 */
import type { AuthoringContext } from "./authoringContext";
import { V2_LIMITS, type CandidateLessonV2, type CandidateScene, type ReviewGap } from "./contract";
import { RENDERABLE_INTERACTIONS } from "./deliverability";
import { isCanonicalToolId, toolFitsContext } from "./tools";

export type ValidationResult = Readonly<{ errors: readonly string[]; gaps: readonly ReviewGap[] }>;

const LEARNER_ACTION_KINDS = new Set(["DIAGRAM_REVEAL", "SINGLE_CHOICE", "MULTI_SELECT", "NUMERIC", "MATCHING", "ORDERING", "DIAGRAM_LABELING", "DRAG_DROP", "FREE_RESPONSE", "SIMULATION_OBSERVATION", "LAB_LAUNCH", "ASSESSMENT_HANDOFF"]);
const FRAMING_TYPES = new Set(["INTRO", "OBJECTIVE", "REVIEW"]);
const COMPLETION_FOR: Record<string, CandidateScene["completion"]> = {
  NONE: "VIEWED", DIAGRAM_REVEAL: "ALL_STEPS_REVEALED", SINGLE_CHOICE: "ALL_ANSWERED", FREE_RESPONSE: "ALL_RESPONSES_WRITTEN",
  LAB_LAUNCH: "LAB_RETURNED_OR_FALLBACK", ASSESSMENT_HANDOFF: "ALL_ANSWERED",
};

/**
 * Whether the runtime can actually collect a scene's responses: through a rendered interaction, or a
 * declared FREE_RESPONSE fallback with exactly one response. Evidence the player can never collect
 * does not count as evidence.
 */
export function evidenceCollectable(scene: CandidateScene): boolean {
  const kind = scene.interaction.kind;
  if (kind === "SINGLE_CHOICE" || kind === "FREE_RESPONSE" || kind === "ASSESSMENT_HANDOFF") return true;
  // Lab results reach the evidence envelope only as LAB_OBSERVATION; any other kind is never emitted.
  if (kind === "LAB_LAUNCH") return scene.evidence.kind === "LAB_OBSERVATION";
  return !RENDERABLE_INTERACTIONS.has(kind) && scene.fallback?.kind === "FREE_RESPONSE" && scene.evidence.kind !== "NONE" && scene.evidence.responses.length === 1;
}

export function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function validateCandidateAgainstContext(candidate: CandidateLessonV2, context: AuthoringContext): ValidationResult {
  const errors: string[] = [];
  const gaps: ReviewGap[] = [];
  const error = (code: string) => errors.push(code);
  const gap = (code: string, severity: ReviewGap["severity"], detail: string, sceneId?: string) => gaps.push({ code, severity, detail, ...(sceneId ? { sceneId } : {}) });
  // The age band is a governed delivery attribute derived from the grade; generated content cannot override it.
  if (candidate.ageBand !== context.ageBand) error(`age_band_mismatch:${candidate.ageBand}`);
  const objectiveIds = new Set(context.objectives.map((objective) => objective.id));
  const misconceptionIds = new Set(candidate.misconceptions.map((misconception) => misconception.id));
  const assessmentIds = new Set(candidate.assessmentRequests.map((request) => request.id));
  const labIds = new Set(candidate.labProposals.map((proposal) => proposal.id));

  // Every id in the lesson is unique: scenes, items, options per item, steps, prompts, responses, misconceptions, requests, proposals.
  const seen = new Set<string>();
  const unique = (id: string, where: string) => { if (seen.has(id)) error(`duplicate_id:${where}:${id}`); seen.add(id); };
  candidate.scenes.forEach((scene) => unique(scene.id, "scene"));
  candidate.misconceptions.forEach((misconception) => unique(misconception.id, "misconception"));
  candidate.assessmentRequests.forEach((request) => unique(request.id, "assessment"));
  candidate.labProposals.forEach((proposal) => unique(proposal.id, "lab"));
  for (const scene of candidate.scenes) {
    const interaction = scene.interaction;
    if (interaction.kind === "DIAGRAM_REVEAL") interaction.steps.forEach((step) => unique(`${scene.id}/${step.id}`, "step"));
    if (interaction.kind === "FREE_RESPONSE") interaction.prompts.forEach((prompt) => unique(prompt.id, "prompt"));
    if (interaction.kind === "SINGLE_CHOICE") {
      for (const item of interaction.items) {
        unique(item.id, "item");
        const optionIds = new Set<string>();
        for (const option of item.options) { if (optionIds.has(option.id)) error(`duplicate_id:option:${item.id}/${option.id}`); optionIds.add(option.id); }
        if (!optionIds.has(item.formativeKey.expectedOptionId)) error(`formative_key_unknown_option:${item.id}`);
      }
    }
    for (const media of scene.media ?? []) unique(`${scene.id}/${media.id}`, "media");
    if (scene.evidence.kind !== "NONE") scene.evidence.responses.forEach((response) => unique(`${scene.id}/${response.responseKey}`, "response"));
  }

  for (const misconception of candidate.misconceptions) if (!objectiveIds.has(misconception.objectiveId)) error(`misconception_objective_unknown:${misconception.id}`);

  const indexOf = new Map(candidate.scenes.map((scene, index) => [scene.id, index]));
  let firstLearnerAction = -1;
  candidate.scenes.forEach((scene, index) => {
    const interaction = scene.interaction;
    // Objectives: exact ids from the pinned context only.
    for (const id of scene.objectiveIds) if (!objectiveIds.has(id)) error(`objective_unknown:${scene.id}:${id}`);
    if (!FRAMING_TYPES.has(scene.type) && scene.objectiveIds.length === 0) error(`objective_required:${scene.id}`);
    // Size: the Phase A cap is a ceiling; age variants obey it too.
    if (words(scene.content.body) > V2_LIMITS.sceneWords) error(`scene_too_long:${scene.id}`);
    for (const [band, variant] of Object.entries(scene.content.ageVariants ?? {})) if (variant && words(variant.body) > V2_LIMITS.sceneWords) error(`age_variant_too_long:${scene.id}:${band}`);
    if (scene.type === "EXPLANATION" && words(scene.content.body) > V2_LIMITS.explanationWordsAdvisory) gap("LONG_EXPLANATION", "ADVISORY", `Explanation is ${words(scene.content.body)} words; consider splitting at an instructional boundary.`, scene.id);
    // Interaction ↔ type ↔ completion coherence.
    const expected = COMPLETION_FOR[interaction.kind];
    if (expected && scene.completion !== expected) error(`completion_mismatch:${scene.id}`);
    if (!RENDERABLE_INTERACTIONS.has(interaction.kind)) {
      if (!scene.fallback) error(`unsupported_interaction_without_fallback:${scene.id}:${interaction.kind}`);
      // The rendered fallback decides completion: a written response must be written, text must be viewed.
      const fallbackCompletion = scene.fallback?.kind === "FREE_RESPONSE" ? "ALL_RESPONSES_WRITTEN" : "VIEWED";
      if (scene.fallback && scene.completion !== fallbackCompletion) error(`completion_mismatch:${scene.id}`);
      gap("UNSUPPORTED_INTERACTION_DECLARED", "ADVISORY", `${interaction.kind} is a declared intent with no renderer yet; learners receive the ${scene.fallback?.kind ?? "missing"} fallback.`, scene.id);
    }
    if (scene.type === "MASTERY_CHECK" && interaction.kind !== "ASSESSMENT_HANDOFF") error(`mastery_requires_assessment_handoff:${scene.id}`);
    if (interaction.kind === "ASSESSMENT_HANDOFF" && scene.type !== "MASTERY_CHECK") error(`assessment_handoff_outside_mastery:${scene.id}`);
    if (scene.evidence.kind === "MASTERY_RESPONSE" && interaction.kind !== "ASSESSMENT_HANDOFF") error(`mastery_evidence_requires_assessment_handoff:${scene.id}`);
    if (interaction.kind === "SINGLE_CHOICE" && scene.type !== "CHECK_UNDERSTANDING" && scene.type !== "PRACTICE" && scene.type !== "GUIDED_EXAMPLE") error(`formative_key_outside_formative_scene:${scene.id}`);
    if (interaction.kind === "SINGLE_CHOICE" && scene.evidence.kind !== "FORMATIVE_OBSERVATION") error(`formative_items_require_formative_evidence:${scene.id}`);
    if (interaction.kind === "LAB_LAUNCH" && (scene.type !== "LAB" || !labIds.has(interaction.labCandidateId))) error(`lab_launch_invalid:${scene.id}`);
    if (scene.type === "LAB" && interaction.kind !== "LAB_LAUNCH") error(`lab_scene_requires_lab_launch:${scene.id}`);
    if (interaction.kind === "ASSESSMENT_HANDOFF" && !assessmentIds.has(interaction.assessmentRequestId)) error(`assessment_request_unknown:${scene.id}`);
    if (LEARNER_ACTION_KINDS.has(interaction.kind) && firstLearnerAction < 0) firstLearnerAction = index;
    // Evidence: valid objectives, explicit response → objective mapping for every collected response.
    if (scene.evidence.kind !== "NONE") {
      if (!evidenceCollectable(scene)) error(`evidence_not_collectable:${scene.id}`);
      for (const response of scene.evidence.responses) {
        if (!scene.objectiveIds.includes(response.objectiveId)) error(`evidence_objective_not_in_scene:${scene.id}:${response.responseKey}`);
        if (response.misconceptionId && !misconceptionIds.has(response.misconceptionId)) error(`evidence_misconception_unknown:${scene.id}:${response.responseKey}`);
      }
      if (scene.objectiveIds.length > 1 && new Set(scene.evidence.responses.map((response) => response.objectiveId)).size < scene.objectiveIds.length) gap("EVIDENCE_OBJECTIVE_UNMAPPED", "ADVISORY", "Scene names more objectives than its responses evidence.", scene.id);
      if (interaction.kind === "SINGLE_CHOICE" && interaction.items.some((item) => !scene.evidence.kind || (scene.evidence.kind !== "NONE" && !scene.evidence.responses.some((response) => response.responseKey === item.id)))) error(`evidence_response_unmapped:${scene.id}`);
      if (interaction.kind === "FREE_RESPONSE" && interaction.prompts.some((prompt) => scene.evidence.kind !== "NONE" && !scene.evidence.responses.some((response) => response.responseKey === prompt.id))) error(`evidence_response_unmapped:${scene.id}`);
    }
    for (const id of scene.misconceptionIds) if (!misconceptionIds.has(id)) error(`misconception_unknown:${scene.id}:${id}`);
    // Dependencies point strictly backwards.
    for (const dependency of scene.dependsOn ?? []) {
      const at = indexOf.get(dependency);
      if (at === undefined) error(`dependency_unknown:${scene.id}:${dependency}`);
      else if (at >= index) error(`dependency_not_earlier:${scene.id}:${dependency}`);
    }
    // Tools: canonical registry ids only; a requested tool the grade/subject never offers is a review gap.
    for (const tool of [...scene.tools.requested, ...scene.tools.prohibited]) if (!isCanonicalToolId(tool)) error(`tool_unknown:${scene.id}:${tool}`);
    if (scene.tools.requested.some((tool) => scene.tools.prohibited.includes(tool))) error(`tool_conflict:${scene.id}`);
    for (const tool of scene.tools.requested) {
      if (isCanonicalToolId(tool) && !toolFitsContext(tool, { grade: context.grade, subject: context.subject, lessonType: scene.type === "MASTERY_CHECK" ? "assessment" : scene.type === "PRACTICE" ? "practice" : "lesson" })) {
        gap("TOOL_NOT_OFFERED_FOR_GRADE", "ADVISORY", `${tool} is not offered for grade ${context.grade} ${context.subject} in this context; learners will not see it.`, scene.id);
      }
    }
    // Accessibility: a real text alternative, a keyboard path, non-pointer alternatives.
    const alt = scene.accessibility.textAlternative.trim();
    if (alt.length < 20 || alt.toLowerCase() === scene.title.trim().toLowerCase()) error(`text_alternative_insufficient:${scene.id}`);
    for (const media of scene.media ?? []) {
      if ((media.kind === "VIDEO" || media.kind === "NARRATION") && !media.transcript) gap("MEDIA_TRANSCRIPT_MISSING", "BLOCKING", `${media.kind} needs a transcript.`, scene.id);
      if (media.requirement === "MEDIA_REQUIRED") gap("MEDIA_ASSET_REQUIRED", "BLOCKING", `Required ${media.kind} has no governed asset; a reviewer supplies one or accepts the fallback.`, scene.id);
    }
    // Offline: every scene that is not fully offline names a renderable fallback.
    if (scene.offline.mode !== "FULL_OFFLINE" && !scene.fallback) error(`offline_fallback_missing:${scene.id}`);
    if (scene.fallback && !scene.fallback.objectivePreserved) gap("FALLBACK_DOES_NOT_PRESERVE_OBJECTIVE", "BLOCKING", "The declared fallback does not teach the objective.", scene.id);
  });

  // Ordering: framing first, mastery after learning, no lesson that is all explanation.
  const types = candidate.scenes.map((scene) => scene.type);
  if (types.includes("INTRO") && types[0] !== "INTRO") error("intro_not_first");
  const firstMastery = types.indexOf("MASTERY_CHECK");
  if (firstMastery >= 0 && (firstLearnerAction < 0 || firstLearnerAction >= firstMastery)) error("mastery_before_learning");
  if (firstMastery >= 0 && types.slice(firstMastery + 1).some((type) => type !== "REVIEW" && type !== "REFLECTION")) error("instruction_after_mastery");
  const objectiveAt = types.indexOf("OBJECTIVE");
  const explanationAt = types.indexOf("EXPLANATION");
  // Inquiry lessons may hold the objective back until after a first explanation: a reviewer call, not an error.
  if (objectiveAt >= 0 && explanationAt >= 0 && objectiveAt > explanationAt) gap("OBJECTIVE_AFTER_EXPLANATION", "ADVISORY", "The objective is stated after the first explanation; confirm this is a deliberate inquiry sequence.");
  if (firstLearnerAction < 0) error("no_learner_action");
  if (candidate.scenes.every((scene) => scene.type === "EXPLANATION" || FRAMING_TYPES.has(scene.type))) error("all_explanation_lesson");
  if (!types.some((type) => type === "CHECK_UNDERSTANDING" || type === "PRACTICE" || type === "GUIDED_EXAMPLE")) gap("NO_FORMATIVE_CHECK", "ADVISORY", "No formative check or practice before assessment.");
  const averageWords = candidate.scenes.reduce((sum, scene) => sum + words(scene.content.body), 0) / candidate.scenes.length;
  if (averageWords > 160) gap("SCENE_DENSITY_HIGH", "ADVISORY", `Average scene length is ${Math.round(averageWords)} words.`);

  // Objective coverage: each target objective is taught with a learner action and evidenced.
  for (const objective of context.objectives) {
    const taught = candidate.scenes.some((scene) => scene.objectiveIds.includes(objective.id) && LEARNER_ACTION_KINDS.has(scene.interaction.kind));
    const evidenced = candidate.scenes.some((scene) => scene.evidence.kind !== "NONE" && evidenceCollectable(scene) && scene.evidence.responses.some((response) => response.objectiveId === objective.id));
    if (!taught) error(`objective_not_taught:${objective.id}`);
    if (!evidenced) gap("OBJECTIVE_NOT_EVIDENCED", "BLOCKING", `${objective.id} has no evidence opportunity.`);
  }

  // Assessment requests and lab proposals reference context objectives only.
  for (const request of candidate.assessmentRequests) {
    for (const id of request.objectiveIds) if (!objectiveIds.has(id)) error(`assessment_objective_unknown:${request.id}`);
    for (const id of request.misconceptionIds) if (!misconceptionIds.has(id)) error(`assessment_misconception_unknown:${request.id}`);
    for (const tool of [...request.tools.requested, ...request.tools.prohibited]) if (!isCanonicalToolId(tool)) error(`tool_unknown:${request.id}:${tool}`);
    if (!candidate.scenes.some((scene) => scene.interaction.kind === "ASSESSMENT_HANDOFF" && scene.interaction.assessmentRequestId === request.id)) error(`assessment_request_unused:${request.id}`);
  }
  for (const proposal of candidate.labProposals) {
    const scene = candidate.scenes.find((candidateScene) => candidateScene.id === proposal.placementSceneId);
    if (!scene || scene.interaction.kind !== "LAB_LAUNCH" || scene.interaction.labCandidateId !== proposal.id) error(`lab_placement_invalid:${proposal.id}`);
  }

  return { errors: [...new Set(errors)], gaps };
}
