import { createHash } from "crypto";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";

/**
 * Curriculum V2 structured lesson generation prompt (governed archive).
 *
 * The model proposes a candidate lesson only. It is told explicitly what it may not decide:
 * approval, publication, release, standards, mastery, next lessons, lab release or teacher
 * overrides. Its JSON is untrusted and passes the strict server parser and validators.
 */
export const curriculumV2LessonArchive = Object.freeze({
  key: "curriculum.v2.lesson",
  systemKey: "curriculum.v2.lesson.system",
  userKey: "curriculum.v2.lesson.user",
  version: "1.0.0",
  createdAt: "2026-10-08T00:00:00.000Z",
});

export const CURRICULUM_V2_SYSTEM_TEMPLATE = [
  "You design one structured learning experience for LiberiaLearn's Lesson Player V2.",
  "Return ONE JSON object matching contract candidate-lesson-v2/1.0.0 and nothing else.",
  "",
  "Think in instructional moves, not pages: a hook or phenomenon, the objective, one concept at a time,",
  "a modelled example, learner action, a check for understanding, a response to a likely misconception,",
  "application, reflection and a mastery handoff. Choose only the scenes the objective needs; do not",
  "split text by length. Most scenes are short (well under 150 words); no scene exceeds 350 words.",
  "",
  "Hard rules:",
  "- Use ONLY the objective ids, concept ids, tool ids and lab ids listed in the brief. Never invent ids.",
  "- Never include approval, release, publication, status, governance, mastery, next-lesson, override,",
  "  eligibility or provenance fields. Those are decided by people and governed systems, not by you.",
  "- Never include answer keys, rubrics, scoring, points or teacher notes. Mastery scenes use",
  "  ASSESSMENT_HANDOFF with an assessmentRequest; items are authored and scored by the assessment authority.",
  "- Formative SINGLE_CHOICE items in CHECK_UNDERSTANDING or PRACTICE scenes may name formativeKey.expectedOptionId",
  "  and give feedback for every option.",
  "- If an interaction needs a renderer that is not listed as supported, still name it, and give a",
  "  fallback that preserves the objective. Do not rewrite it as multiple choice.",
  "- Media: describe the intent and alt text only. Never write URLs or asset paths.",
  "- Every scene declares a keyboard path, a text alternative that teaches the scene without visuals,",
  "  and an offline mode; anything not FULL_OFFLINE needs a fallback.",
  "- Every response a scene collects maps to one objective id in that scene's evidence.responses.",
  "- Labs may only be proposed from the brief's lab list, for the objective that lab supports.",
  "- Use Liberian names, places and contexts; illustrative numbers must be plausible and not presented as statistics.",
].join("\n");

export const CURRICULUM_V2_USER_TEMPLATE = [
  "Generation brief (trusted, server-built):",
  "{{brief}}",
  "",
  "Return the candidate lesson JSON now.",
].join("\n");

export const curriculumV2SystemPrompt = registerPromptDefinition({ key: curriculumV2LessonArchive.systemKey, version: curriculumV2LessonArchive.version, template: CURRICULUM_V2_SYSTEM_TEMPLATE, createdAt: curriculumV2LessonArchive.createdAt });
export const curriculumV2UserPrompt = registerPromptDefinition({ key: curriculumV2LessonArchive.userKey, version: curriculumV2LessonArchive.version, template: CURRICULUM_V2_USER_TEMPLATE, createdAt: curriculumV2LessonArchive.createdAt });

/** One hash for the prompt pair, recorded on every artifact's provenance. */
export const curriculumV2PromptHash = createHash("sha256").update(`${curriculumV2SystemPrompt.hash}:${curriculumV2UserPrompt.hash}`).digest("hex");
