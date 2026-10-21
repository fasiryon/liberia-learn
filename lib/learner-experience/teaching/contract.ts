/**
 * Student Experience V3 P1 — authorable teaching-scene contract (presentation layer).
 *
 * A TeachingLesson describes how reviewed content teaches: ordered scenes, each with authored text and
 * structured visual/interactive blocks (place-value chart, digit cards, worked steps, process cycle,
 * sort, sequence, formative check). It reuses the Lesson Experience vocabulary (`ContentAuthorityStatus`,
 * `FormativeItem`, `AgeBand`) instead of a second authority model.
 *
 * Authority stays where it is: the contract never decides release. `teachingLessonAvailability` reads the
* existing published-release registry (through `releasedTeachingAvailability` in ./availability.ts, server
 * side), so a lesson that merely *says* APPROVED_RELEASE but has no matching
 * registered release is shown as a candidate, never as released. Checks are formative only (instant,
 * on-device feedback); no block scores, records completion, writes evidence or changes mastery, and an
 * assessment item can never be authored here (assessment stays behind the server's assessment seam).
 */
import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import type { AgeBand, ContentAuthorityStatus, FormativeItem } from "@/lib/learner-experience/types";
import { MAX_DEMO_NUMBER, PLACES, type PlaceId } from "@/lib/learner-experience/demo/placeValue";
import { blockRequiresCompletion, validateBlock, type VisualBlock } from "./registry";

export const TEACHING_LESSON_CONTRACT_VERSION = "teaching-lesson/1.0.0" as const;

export const TEACHING_SCENE_KINDS = ["INTRODUCTION", "LEARN", "EXPLORE", "WORKED_EXAMPLE", "GUIDED_PRACTICE", "PRACTICE", "REVIEW"] as const;
export type TeachingSceneKind = (typeof TEACHING_SCENE_KINDS)[number];

export const TEACHING_SCENE_KIND_LABEL: Record<TeachingSceneKind, string> = {
  INTRODUCTION: "Introduction", LEARN: "Learn", EXPLORE: "Explore", WORKED_EXAMPLE: "Worked example",
  GUIDED_PRACTICE: "Guided practice", PRACTICE: "Practice", REVIEW: "Review",
};

/** Subjects the visual blocks have been designed and tested for. Others may still use generic blocks. */
export type TeachingSubject = "MATHEMATICS" | "SCIENCE" | "ENGLISH" | "SOCIAL_STUDIES";

export type TeachingBlock =
  /** One large number split into its comma groups (millions / thousands / ones). */
  | Readonly<{ type: "GROUPED_NUMBER"; value: number; caption: string }>
  /** Place-value chart; `highlight` marks one place by outline and text, never colour alone. */
  | Readonly<{ type: "PLACE_VALUE_CHART"; value: number; highlight?: PlaceId; caption: string }>
  /** The same digit moved one place left at a time: each move is worth ten times more. */
  | Readonly<{ type: "TEN_TIMES"; digit: number; caption: string }>
  /** Change any place with + / − and see expanded form and words update. */
  | Readonly<{ type: "NUMBER_BUILDER"; start: number; presets: readonly number[]; task?: string }>
  /** Digit cards (whole numbers only) placed into place-value slots to make a target number. */
  | Readonly<{ type: "DIGIT_CARDS"; id: string; target: number; prompt: string }>
  /** Worked example revealed one authored step at a time; a step may point at a place in the chart. */
  | Readonly<{ type: "STEP_REVEAL"; id: string; question: string; chartValue?: number; steps: readonly Readonly<{ text: string; highlight?: PlaceId }>[] }>
  /** Formative choice questions with authored feedback per option (misconception-specific). */
  | Readonly<{ type: "CHOICE_CHECK"; id: string; items: readonly (FormativeItem & { hint?: string })[] }>
  /** A cycle of stages (e.g. the water cycle); select a stage to read about it. */
  | Readonly<{ type: "PROCESS_CYCLE"; id: string; title: string; stages: readonly Readonly<{ id: string; label: string; detail: string }>[] }>
  /** Sort cards into groups (e.g. nouns / verbs / adjectives); each card carries its own feedback. */
  | Readonly<{ type: "SORT"; id: string; prompt: string; groups: readonly Readonly<{ id: string; label: string }>[]; cards: readonly Readonly<{ id: string; text: string; group: string; why: string }>[] }>
  /** Put events in order, then see them on a timeline. `marker` is the label shown on the line (e.g. a year). */
  | Readonly<{ type: "SEQUENCE"; id: string; prompt: string; events: readonly Readonly<{ id: string; label: string; marker: string; detail: string }>[] }>
  /** A short authored callout: a tip, or a common mistake to avoid. */
  | Readonly<{ type: "CALLOUT"; tone: "TIP" | "MISTAKE"; title: string; text: string }>
  /** Interactive Learning V4: any block of the Visual Teaching Block Registry (lib/learner-experience/teaching/registry.ts). */
  | VisualBlock;

export type InteractiveBlock = Extract<TeachingBlock, { id: string }>;

export type TeachingScene = Readonly<{
  id: string;
  kind: TeachingSceneKind;
  title: string;
  lead: string;
  objectiveIds: readonly string[];
  points?: readonly string[];
  /** Blocks shown in the main text column, in order. */
  blocks: readonly TeachingBlock[];
  /** At most one block shown as the scene's primary visual beside the text on wide stages. */
  visual?: TeachingBlock;
  /** An authored hint shown on request in the help rail. */
  hint?: string;
  /** Everything the scene teaches, as text: read aloud and used when visuals are unavailable. */
  textAlternative: string;
}>;

export type TeachingLesson = Readonly<{
  contractVersion: typeof TEACHING_LESSON_CONTRACT_VERSION;
  id: string;
  version: string;
  title: string;
  subject: TeachingSubject;
  /** Shown in the header, e.g. "Number sense". */
  topic: string;
  grade: number;
  ageBand: AgeBand;
  authority: Readonly<{ status: ContentAuthorityStatus; releaseId: string | null; note: string }>;
  objectives: readonly Readonly<{ id: string; statement: string }>[];
  scenes: readonly TeachingScene[];
}>;

export class TeachingContractError extends Error {}

/** Blocks a learner must finish before Continue: all worked steps shown, all checks answered, cards placed. */
export function requiresInteraction(block: TeachingBlock): block is InteractiveBlock {
  if (block.type === "CHOICE_CHECK") return true;
  return blockRequiresCompletion(block as VisualBlock);
}

export function sceneBlocks(scene: TeachingScene): readonly TeachingBlock[] {
  return scene.visual ? [...scene.blocks, scene.visual] : scene.blocks;
}

function validNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_DEMO_NUMBER;
}

/** Structural validation. Returns problem codes (empty = valid); `assertTeachingLesson` throws on the first. */
export function validateTeachingLesson(lesson: TeachingLesson): string[] {
  const problems: string[] = [];
  const fail = (code: string) => problems.push(code);
  if (lesson.contractVersion !== TEACHING_LESSON_CONTRACT_VERSION) fail("contract_version_unsupported");
  if (!lesson.id || !lesson.version) fail("identity_required");
  if (lesson.authority.status === "APPROVED_RELEASE" && !lesson.authority.releaseId) fail("approved_release_requires_release_id");
  if (lesson.scenes.length < 2) fail("requires_multiple_scenes");
  const objectiveIds = new Set(lesson.objectives.map((objective) => objective.id));
  if (objectiveIds.size === 0) fail("objectives_required");
  const sceneIds = new Set<string>();
  const blockIds = new Set<string>();
  const places = new Set<string>(PLACES.map((place) => place.id));
  for (const scene of lesson.scenes) {
    if (sceneIds.has(scene.id)) fail(`scene_id_duplicate:${scene.id}`);
    sceneIds.add(scene.id);
    if (!(TEACHING_SCENE_KINDS as readonly string[]).includes(scene.kind)) fail(`scene_kind_unknown:${scene.id}`);
    if (!scene.title.trim() || !scene.lead.trim()) fail(`scene_text_required:${scene.id}`);
    if (!scene.textAlternative.trim()) fail(`scene_text_alternative_required:${scene.id}`);
    for (const id of scene.objectiveIds) if (!objectiveIds.has(id)) fail(`scene_objective_unknown:${scene.id}`);
    for (const block of sceneBlocks(scene)) {
      if ("id" in block) {
        if (blockIds.has(block.id)) fail(`block_id_duplicate:${block.id}`);
        blockIds.add(block.id);
      }
      switch (block.type) {
        case "GROUPED_NUMBER": case "PLACE_VALUE_CHART":
          if (!validNumber(block.value)) fail(`number_out_of_range:${scene.id}`);
          if (block.type === "PLACE_VALUE_CHART" && block.highlight && !places.has(block.highlight)) fail(`place_unknown:${scene.id}`);
          break;
        case "TEN_TIMES": if (!Number.isInteger(block.digit) || block.digit < 1 || block.digit > 9) fail(`digit_invalid:${scene.id}`); break;
        case "NUMBER_BUILDER": if (!validNumber(block.start) || block.presets.some((preset) => !validNumber(preset))) fail(`number_out_of_range:${scene.id}`); break;
        case "DIGIT_CARDS": if (!validNumber(block.target) || block.target < 1_000_000) fail(`digit_cards_target_invalid:${block.id}`); break;
        case "STEP_REVEAL":
          if (block.steps.length === 0) fail(`steps_required:${block.id}`);
          if (block.chartValue !== undefined && !validNumber(block.chartValue)) fail(`number_out_of_range:${block.id}`);
          for (const step of block.steps) if (step.highlight && !places.has(step.highlight)) fail(`place_unknown:${block.id}`);
          break;
        case "CHOICE_CHECK":
          if (block.items.length === 0) fail(`items_required:${block.id}`);
          for (const item of block.items) {
            if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= item.options.length) fail(`item_key_invalid:${block.id}:${item.id}`);
            // Every wrong option must answer its own misconception; generic "incorrect" feedback is not enough.
            if (!item.optionFeedback || item.optionFeedback.length !== item.options.length || item.optionFeedback.some((text) => !text.trim())) fail(`option_feedback_required:${block.id}:${item.id}`);
          }
          break;
        case "PROCESS_CYCLE": if (block.stages.length < 3) fail(`cycle_requires_three_stages:${block.id}`); break;
        case "SORT": {
          const groups = new Set(block.groups.map((group) => group.id));
          if (groups.size < 2) fail(`sort_requires_two_groups:${block.id}`);
          for (const card of block.cards) if (!groups.has(card.group)) fail(`sort_card_group_unknown:${block.id}:${card.id}`);
          break;
        }
        case "SEQUENCE": if (block.events.length < 3) fail(`sequence_requires_three_events:${block.id}`); break;
        case "CALLOUT": if (!block.text.trim()) fail(`callout_text_required:${scene.id}`); break;
        // V4 blocks are checked by the registry: schema, model consistency and subject/grade fit.
        default: for (const problem of validateBlock(block, { subject: lesson.subject, grade: lesson.grade }).problems) fail(problem);
      }
    }
  }
  return problems;
}

export function assertTeachingLesson(lesson: TeachingLesson): TeachingLesson {
  const problems = validateTeachingLesson(lesson);
  if (problems.length) throw new TeachingContractError(problems[0]);
  return lesson;
}

export type TeachingAvailability = Readonly<{
  /** RELEASED only when the existing registry holds a matching release. */
  label: "RELEASED" | "CANDIDATE" | "DEMO" | "LEGACY";
  /** Whether a student route may present it as their lesson. Only RELEASED is. */
  learnerDeliverable: boolean;
  chip: string;
  reason: string;
}>;

const SUBJECT_RELEASE_CODE: Record<TeachingSubject, string> = { MATHEMATICS: "MATH", SCIENCE: "SCIENCE", ENGLISH: "ENGLISH", SOCIAL_STUDIES: "SOCIAL_STUDIES" };

/**
 * Released versus candidate versus demo, decided from a release registry lookup, never from the lesson's
 * own claim. Pure: callers pass the registry (`./availability.ts` binds the published registry server side,
 * so client bundles never load it).
 */
export function teachingLessonAvailability(lesson: TeachingLesson, lookup: (id: string) => CurriculumOntologyRelease | null): TeachingAvailability {
  const { status, releaseId } = lesson.authority;
  if (status === "PROTOTYPE_FIXTURE") return { label: "DEMO", learnerDeliverable: false, chip: "DEMO · not a released lesson", reason: "Synthetic preview content for design review. It is not curriculum and nothing here is saved, sent or marked." };
  if (status === "LEGACY_UNGOVERNED") return { label: "LEGACY", learnerDeliverable: false, chip: "Legacy content", reason: "Legacy lesson text that has not been through native review." };
  if (status === "APPROVED_RELEASE" && releaseId) {
    let release: CurriculumOntologyRelease | null = null;
    try { release = lookup(releaseId); } catch { release = null; }
    if (release && release.grade === lesson.grade && release.subject === SUBJECT_RELEASE_CODE[lesson.subject]) {
      return { label: "RELEASED", learnerDeliverable: true, chip: "Released", reason: `Registered release ${release.id}.` };
    }
    return { label: "CANDIDATE", learnerDeliverable: false, chip: "CANDIDATE · not released", reason: "This lesson names a release that is not in the published registry for its grade and subject, so it is treated as a candidate." };
  }
  return { label: "CANDIDATE", learnerDeliverable: false, chip: "CANDIDATE · not released", reason: "Draft content awaiting review and release. It is not delivered to students." };
}
