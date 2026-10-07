/**
 * Scene contract validation and the slide → scene migration hierarchy.
 *
 * 1. NATIVE_SCENES          authored/generated LessonExperience scenes (authority)
 * 2. GOVERNED_SECTIONS      NR-13 learner materials (studentMaterials) mapped to scenes
 * 3. PARSED_SLIDES_FALLBACK parseToSlides over a legacy body (compatibility only)
 * 4. LEGACY_READ_MODE       one read-mode scene when nothing else is usable
 *
 * parseToSlides infers structure after lesson creation and can collapse a
 * long body into one giant slide; it is never the canonical lesson structure.
 */
import { parseToSlides } from "@/lib/lessons/parseToSlides";
import { SCENE_TYPES, LESSON_EXPERIENCE_CONTRACT_VERSION, type AgeBand, type LessonExperience, type Scene, type SceneSource } from "./types";

export class SceneContractError extends Error {}

/** Toolkit ids a scene may name (lib/toolkit/toolRegistry.ts); unknown ids are rejected, not rebuilt. */
export const KNOWN_TOOL_IDS = Object.freeze([
  "basic-calculator", "scientific-calculator", "fraction-visualizer", "number-line", "digital-ruler", "protractor",
  "multiplication-table", "periodic-table", "unit-converter", "coordinate-grid", "timer", "dictionary",
]);

const ONE_SCENE_WORD_CEILING = 350;

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function validateLessonExperience(experience: LessonExperience): void {
  const fail = (code: string) => { throw new SceneContractError(code); };
  if (experience.contractVersion !== LESSON_EXPERIENCE_CONTRACT_VERSION) fail("experience_contract_unsupported");
  if (!experience.id || !experience.version) fail("experience_identity_required");
  if (experience.scenes.length < 2) fail("experience_requires_multiple_scenes");
  const objectiveIds = new Set(experience.objectives.map((objective) => objective.id));
  if (objectiveIds.size === 0) fail("experience_objectives_required");
  const sceneIds = new Set<string>();
  for (const scene of experience.scenes) {
    if (sceneIds.has(scene.id)) fail(`scene_id_duplicate:${scene.id}`);
    sceneIds.add(scene.id);
    if (!(SCENE_TYPES as readonly string[]).includes(scene.type)) fail(`scene_type_unknown:${scene.id}`);
    for (const id of scene.objectiveIds) if (!objectiveIds.has(id)) fail(`scene_objective_unknown:${scene.id}`);
    if (!scene.accessibility.textAlternative.trim()) fail(`scene_text_alternative_required:${scene.id}`);
    for (const media of scene.media ?? []) {
      if (!media.alt.trim()) fail(`scene_media_alt_required:${scene.id}`);
      if ((media.kind === "VIDEO" || media.kind === "AUDIO") && !media.transcript && !media.captionsRef) fail(`scene_media_captions_required:${scene.id}`);
    }
    for (const tool of [...scene.tools.allowed, ...scene.tools.prohibited]) if (!KNOWN_TOOL_IDS.includes(tool)) fail(`scene_tool_unknown:${scene.id}:${tool}`);
    if (scene.tools.allowed.some((tool) => scene.tools.prohibited.includes(tool))) fail(`scene_tool_conflict:${scene.id}`);
    // A native scene is a focused unit of instruction, not a page.
    if (wordCount(scene.content.body) > ONE_SCENE_WORD_CEILING) fail(`scene_too_long:${scene.id}`);
    if (scene.evidence.kind !== "NONE") for (const id of scene.evidence.objectiveIds) if (!objectiveIds.has(id)) fail(`scene_evidence_objective_unknown:${scene.id}`);
    // Completion rules must be satisfiable by the scene's interaction.
    const kind = scene.interaction.kind;
    const rule = scene.completion.kind;
    if (rule === "ALL_STEPS_REVEALED" && kind !== "DIAGRAM_REVEAL") fail(`scene_completion_mismatch:${scene.id}`);
    if (rule === "ALL_ANSWERED" && kind !== "MULTIPLE_CHOICE" && kind !== "ASSESSMENT_HANDOFF") fail(`scene_completion_mismatch:${scene.id}`);
    if (rule === "ALL_RESPONSES_WRITTEN" && kind !== "FREE_RESPONSE") fail(`scene_completion_mismatch:${scene.id}`);
    if (rule === "LAB_RETURNED_OR_FALLBACK" && kind !== "LAB_LAUNCH") fail(`scene_completion_mismatch:${scene.id}`);
    if (scene.type === "MASTERY_CHECK" && (kind !== "ASSESSMENT_HANDOFF" || scene.evidence.kind !== "MASTERY_RESPONSE")) fail(`scene_mastery_requires_assessment_handoff:${scene.id}`);
    if (kind === "MULTIPLE_CHOICE") for (const item of scene.interaction.items) if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length) fail(`scene_item_key_invalid:${scene.id}`);
  }
}

/** Age-band wording for the same scene; the objective, interaction and evidence never change. */
export function sceneBodyFor(scene: Scene, band: AgeBand): { body: string; keyPoints: readonly string[] } {
  const variant = scene.content.ageVariants?.[band];
  return { body: variant?.body ?? scene.content.body, keyPoints: variant?.keyPoints ?? scene.content.keyPoints ?? [] };
}

export type ResolvedScene = Readonly<{ id: string; title: string; body: string; type: Scene["type"] }>;
export type ResolvedLessonScenes = Readonly<{ source: SceneSource; scenes: readonly ResolvedScene[] }>;

export type GovernedSections = Readonly<{
  learnerMaterial?: string | null;
  guidedItems?: readonly string[];
  independentItems?: readonly string[];
  masteryTask?: string | null;
}>;

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function list(items: readonly string[] | undefined): string {
  return (items ?? []).map((item, index) => `${index + 1}. ${item}`).join("\n");
}

/** Resolve the scenes a learner should see, walking the migration hierarchy in order. */
export function resolveLessonScenes(input: {
  title: string;
  ageBand?: AgeBand;
  native?: LessonExperience | null;
  governedSections?: GovernedSections | null;
  legacyBody?: string | null;
  takeawaySummary?: string | null;
}): ResolvedLessonScenes {
  if (input.native) {
    validateLessonExperience(input.native);
    const band = input.ageBand ?? input.native.ageBand;
    return { source: "NATIVE_SCENES", scenes: input.native.scenes.map((scene) => ({ id: scene.id, title: scene.title, type: scene.type, body: sceneBodyFor(scene, band).body })) };
  }
  const sections = input.governedSections;
  if (sections && nonEmpty(sections.learnerMaterial)) {
    const scenes: ResolvedScene[] = [{ id: "learn", title: input.title, type: "EXPLANATION", body: sections.learnerMaterial }];
    if (sections.guidedItems?.length) scenes.push({ id: "guided", title: "Work through it together", type: "GUIDED_EXAMPLE", body: list(sections.guidedItems) });
    if (sections.independentItems?.length) scenes.push({ id: "practice", title: "Practice on your own", type: "PRACTICE", body: list(sections.independentItems) });
    if (nonEmpty(sections.masteryTask)) scenes.push({ id: "mastery", title: "Show what you know", type: "MASTERY_CHECK", body: sections.masteryTask });
    return { source: "GOVERNED_SECTIONS", scenes };
  }
  if (nonEmpty(input.legacyBody)) {
    const slides = parseToSlides({ title: input.title, content: input.legacyBody, takeawaySummary: input.takeawaySummary });
    if (slides.length > 1) return { source: "PARSED_SLIDES_FALLBACK", scenes: slides.map((slide) => ({ id: `slide-${slide.index}`, title: slide.title, type: "EXPLANATION", body: slide.content })) };
    return { source: "LEGACY_READ_MODE", scenes: [{ id: "read", title: input.title, type: "EXPLANATION", body: input.legacyBody }] };
  }
  return { source: "LEGACY_READ_MODE", scenes: [{ id: "read", title: input.title, type: "EXPLANATION", body: "No lesson text is available." }] };
}
