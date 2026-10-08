/**
 * Curriculum V2 → Lesson Player V2 compatibility (scene migration hierarchy level 1).
 *
 * Produces the Phase A LessonExperience the runtime already plays. This is also the learner
 * projection of a native artifact: reviewer/teacher fields (expected observations, misconception
 * notes, rationales, provenance, governance, gap list) never cross it, and mastery scenes carry
 * only governed item refs with no keys. Interactions the player cannot render are delivered
 * through their declared fallback, never re-typed as something they are not.
 */
import { LEARNING_EXPERIENCE_LINK_VERSION, type LearningExperienceLink } from "@/lib/learner-experience/links";
import { LESSON_EXPERIENCE_CONTRACT_VERSION, type LessonExperience, type Scene, type SceneInteraction, type SceneOffline } from "@/lib/learner-experience/types";
import type { CandidateScene, CurriculumLessonV2 } from "./contract";
import { RENDERABLE_INTERACTIONS } from "./deliverability";

const OFFLINE: Record<CandidateScene["offline"]["mode"], SceneOffline["mode"]> = {
  FULL_OFFLINE: "FULL", CACHED_ASSET_REQUIRED: "DEGRADED", ONLINE_ENHANCED: "DEGRADED", FALLBACK_REQUIRED: "DEGRADED",
};

function interactionFor(scene: CandidateScene, lesson: CurriculumLessonV2): { interaction: SceneInteraction; completion: Scene["completion"]; body: string } {
  const interaction = scene.interaction;
  const fallbackBody = scene.fallback ? `${scene.content.body}\n\n${scene.fallback.content}` : scene.content.body;
  if (!RENDERABLE_INTERACTIONS.has(interaction.kind)) {
    // Declared intent without a renderer: deliver the explicit fallback as its declared kind (validation
    // guarantees one exists). A FREE_RESPONSE fallback is a real input that still collects the evidence.
    if (scene.fallback?.kind === "FREE_RESPONSE") {
      const responseKey = scene.evidence.kind !== "NONE" && scene.evidence.responses.length === 1 ? scene.evidence.responses[0].responseKey : `${scene.id}-response`;
      return { interaction: { kind: "FREE_RESPONSE", prompts: [{ id: responseKey, prompt: scene.fallback.content, minLength: 1 }] }, completion: { kind: "ALL_RESPONSES_WRITTEN" }, body: scene.content.body };
    }
    return { interaction: { kind: "NONE" }, completion: { kind: "VIEWED" }, body: fallbackBody };
  }
  // Required media the player cannot render: the fallback content is always part of the scene.
  const missingMedia = (scene.media ?? []).some((media) => media.requirement === "MEDIA_REQUIRED");
  const body = missingMedia && scene.fallback ? fallbackBody : scene.content.body;
  switch (interaction.kind) {
    case "DIAGRAM_REVEAL": return { interaction: { kind: "DIAGRAM_REVEAL", diagramId: scene.id, steps: interaction.steps.map(({ id, label, description }) => ({ id, label, description })) }, completion: { kind: "ALL_STEPS_REVEALED" }, body };
    case "SINGLE_CHOICE": return {
      interaction: {
        kind: "MULTIPLE_CHOICE",
        items: interaction.items.map((item) => {
          const correctIndex = item.options.findIndex((option) => option.id === item.formativeKey.expectedOptionId);
          const expected = item.options[correctIndex];
          const other = item.options.find((option) => option.id !== expected.id);
          // Every option keeps its own authored feedback, so each distractor answers its own misconception.
          return { id: item.id, prompt: item.prompt, options: item.options.map((option) => option.text), correctIndex, feedback: { correct: expected.feedback, incorrect: other?.feedback ?? scene.hints[0] ?? "Look again at the example." }, optionFeedback: item.options.map((option) => option.feedback) };
        }),
      },
      completion: { kind: "ALL_ANSWERED" }, body,
    };
    case "FREE_RESPONSE": return { interaction: { kind: "FREE_RESPONSE", prompts: interaction.prompts.map(({ id, prompt, minLength }) => ({ id, prompt, minLength })) }, completion: { kind: "ALL_RESPONSES_WRITTEN" }, body };
    case "LAB_LAUNCH": {
      const link = lesson.labLinks.find((entry) => entry.proposalId === interaction.labCandidateId);
      return { interaction: { kind: "LAB_LAUNCH", linkId: link?.link.linkId ?? interaction.labCandidateId }, completion: { kind: "LAB_RETURNED_OR_FALLBACK" }, body };
    }
    case "ASSESSMENT_HANDOFF": {
      const handoff = lesson.assessmentHandoffs.find((entry) => entry.requestId === interaction.assessmentRequestId)!;
      return {
        // Re-picked field by field: a stored artifact cannot smuggle a key into the learner's mastery scene.
        interaction: { kind: "ASSESSMENT_HANDOFF", assessment: { assessmentId: `${lesson.identity.lessonId}--${handoff.requestId}`, assessmentVersion: lesson.identity.version, player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", objectiveIds: handoff.objectiveIds, items: handoff.governedItems.map(({ itemId, itemVersion, prompt, options }) => ({ itemId, itemVersion, prompt, options: [...options] })) } },
        completion: { kind: "ALL_ANSWERED" }, body,
      };
    }
    default: return { interaction: { kind: "NONE" }, completion: { kind: "VIEWED" }, body };
  }
}

export function toLessonExperience(lesson: CurriculumLessonV2): LessonExperience {
  const scenes: Scene[] = lesson.scenes.map((scene) => {
    const { interaction, completion, body } = interactionFor(scene, lesson);
    const evidence: Scene["evidence"] = scene.evidence.kind === "NONE"
      ? { kind: "NONE" }
      : { kind: scene.evidence.kind, evidenceType: scene.evidence.evidenceType, objectiveIds: [...new Set(scene.evidence.responses.map((response) => response.objectiveId))] };
    const ageVariants = scene.content.ageVariants
      ? Object.fromEntries(Object.entries(scene.content.ageVariants).filter(([, variant]) => !!variant).map(([band, variant]) => [band, { body: variant!.body, ...(variant!.keyPoints ? { keyPoints: variant!.keyPoints } : {}) }]))
      : undefined;
    return {
      id: scene.id,
      type: scene.type,
      title: scene.title,
      objectiveIds: scene.objectiveIds,
      content: { body, ...(scene.content.keyPoints ? { keyPoints: scene.content.keyPoints } : {}), ...(ageVariants ? { ageVariants } : {}) },
      interaction,
      tools: { allowed: scene.tools.requested.filter((tool) => !scene.tools.prohibited.includes(tool)), prohibited: scene.tools.prohibited },
      accessibility: {
        // A LAB scene's walkthrough (shown when the lab cannot open) is its declared fallback.
        textAlternative: scene.type === "LAB" && scene.fallback ? scene.fallback.content : scene.accessibility.textAlternative,
        // Pointer-only intents were replaced by their fallback above; a lab may still need a pointer.
        keyboardOperable: scene.interaction.kind !== "LAB_LAUNCH" || !!scene.fallback,
        reducedMotionSafe: !(scene.media ?? []).some((media) => (media.kind === "ANIMATION" || media.kind === "VIDEO" || media.kind === "INTERACTIVE_MODEL") && media.requirement !== "TEXT_FALLBACK") || scene.accessibility.reducedMotion === "STATIC_EQUIVALENT",
        captionsRequired: (scene.media ?? []).some((media) => media.kind === "VIDEO" || media.kind === "NARRATION"),
      },
      offline: { mode: OFFLINE[scene.offline.mode], fallback: scene.fallback?.content ?? scene.offline.note },
      evidence,
      completion,
    };
  });
  return {
    contractVersion: LESSON_EXPERIENCE_CONTRACT_VERSION,
    id: lesson.identity.lessonId,
    version: lesson.identity.version,
    title: lesson.identity.title,
    subject: lesson.identity.subject,
    grade: lesson.identity.grade,
    ageBand: lesson.ageBand,
    authority: { status: "CURRICULUM_V2_DRAFT", note: "Curriculum V2 draft. Requires exact-revision human review; not approved, not published.", candidateContentIds: [], releaseId: lesson.authoring.releaseId, releaseIdentity: lesson.authoring.releaseIdentity },
    objectives: lesson.objectives.map((objective) => ({ id: objective.id, statement: objective.statement, conceptId: objective.conceptIds[0] ?? objective.id, standardCodes: objective.standardCodes, skillIds: objective.skillIds })),
    scenes,
    // Not packageable while any scene needs an asset that has no governed source yet.
    offline: { packageable: lesson.scenes.every((scene) => (scene.offline.mode === "FULL_OFFLINE" || !!scene.fallback) && scene.offline.mode !== "CACHED_ASSET_REQUIRED" && !(scene.media ?? []).some((media) => media.requirement === "MEDIA_REQUIRED")), requiredAssets: [] },
  };
}

/** The candidate lab links as Phase A links (always CANDIDATE). */
export function lessonLinks(lesson: CurriculumLessonV2): LearningExperienceLink[] {
  return lesson.labLinks.map((entry) => ({ ...entry.link, contractVersion: LEARNING_EXPERIENCE_LINK_VERSION }));
}
