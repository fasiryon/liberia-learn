import { readFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { z } from "zod";
import inputs from "@/curriculum/factory-v4/reference-inputs.json";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import { evaluateV4Standard } from "@/lib/curriculum/v4/standard";
import { V4_LESSONS, type V4Lesson } from "@/lib/curriculum/v4/candidates";
import { TEACHING_BLOCK_REGISTRY, TEACHING_BLOCK_REGISTRY_VERSION, blockRequiresCompletion, blockTextAlternative, generationCatalogue, type VisualBlock } from "@/lib/learner-experience/teaching/registry";
import { authorLesson } from "./lessonAuthor";
import { INSTRUCTION_PATTERNS, V4_INSTRUCTION_STANDARD } from "@/lib/learner-experience/teaching/instruction";
import { assertLearnerSafe, protectedStrings } from "@/lib/assessment/v2/projection";
import type { AssessmentItemV2, ProtectedScoringSpec } from "@/lib/assessment/v2/types";
import { sealBlueprint, UNIT_BLUEPRINT_V4_VERSION } from "../v2/blueprint";
import type { FactoryExecutors, ResourceDraft } from "../v2/types";
import { VISUAL_TEACHING_CONTRACT, sourcePinSchema, visualTeachingSidecarSchema, type VisualTeachingSidecar } from "./visualTeachingBlock";

export const CANDIDATE_VERSION = "4.0.0-draft.4";
export const hash = (value: unknown) => createHash("sha256").update(canonicalizeJson(value)).digest("hex");
export const normalizedFile = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
export const textHash = (text: string) => createHash("sha256").update(text).digest("hex");
const pinFile = z.strictObject({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export const referenceInputsSchema = z.strictObject({
  version: z.literal("factory-v4-reference-inputs/1.0.0"), encoding: z.literal("UTF8_LF"),
  frontendCommit: z.string().regex(/^[a-f0-9]{40}$/),
  sources: z.array(sourcePinSchema).min(1), candidates: z.array(pinFile).length(6),
});
export const referenceInputs = referenceInputsSchema.parse(inputs);

/** Pins are committed inputs, never recalculated and trusted on a generation run. No network or DB reads. */
export function verifyReferenceInputs(root = process.cwd(), pins = referenceInputs) {
  for (const pin of [...pins.sources, ...pins.candidates]) {
    const file = path.resolve(root, pin.path);
    if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error("source_path_outside_repository");
    if (textHash(normalizedFile(file)) !== pin.sha256) throw new Error(`source_pin_mismatch:${pin.path}`);
  }
  const moe: unknown = JSON.parse(normalizedFile(path.join(root, "curriculum/structured/moe-structured-v1.json")));
  const itemIds = new Set<string>();
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if ("id" in value && typeof value.id === "string" && value.id.startsWith("moe-")) itemIds.add(value.id);
    Object.values(value).forEach(collect);
  };
  collect(moe);
  for (const lesson of V4_LESSONS) for (const objective of lesson.objectives) for (const ref of objective.moeReferences) {
    if (!itemIds.has(ref.moeItemId)) throw new Error(`moe_reference_not_in_pinned_source:${ref.moeItemId}`);
  }
}

export function misconceptionSignals(block: VisualBlock) {
  switch (block.type) {
    case "NUMERIC_RESPONSE": return block.parts.flatMap(p => p.misconceptions.flatMap(m => m.misconceptionId ? [{ misconceptionId: m.misconceptionId, responsePattern: `${p.id}:NUMBER:${m.value}`, feedback: m.feedback }] : []));
    case "CHECK": return block.items.flatMap(item => item.misconceptionId ? item.options.filter(o => o.id !== item.formativeKey.expectedOptionId).map(o => ({ misconceptionId: item.misconceptionId!, responsePattern: `${item.id}:OPTION:${o.id}`, feedback: o.feedback })) : []);
    case "MISTAKE_ANALYSIS": return block.misconceptionId ? block.options.filter(o => o.id !== block.formativeKey.expectedOptionId).map(o => ({ misconceptionId: block.misconceptionId!, responsePattern: `OPTION:${o.id}`, feedback: o.feedback })) : [];
    case "SORT": return block.misconceptionId ? block.cards.map(c => ({ misconceptionId: block.misconceptionId!, responsePattern: `MISGROUP:${c.id}`, feedback: c.why })) : [];
    default: return [];
  }
}

/** The existing factory executor/provider consumes this brief; no second generator or provider is introduced. */
export function v4GenerationBrief(context: { subject: string; grade: number }) {
  return { contractVersion: VISUAL_TEACHING_CONTRACT, registryVersion: TEACHING_BLOCK_REGISTRY_VERSION,
    instructionStandard: V4_INSTRUCTION_STANDARD, patterns: INSTRUCTION_PATTERNS,
    blocks: generationCatalogue(context),
    rules: ["Use blocks only to teach or elicit an objective-linked response.",
      "Typeset math using supported TeX and bind diagrams to their actual model values.",
      "Keep hints and worked support out of independent scenes. Teaching feedback follows an attempt.",
      "Mastery uses only Assessment Player V2 handoff; never generate protected keys in teaching content.",
      "Label invented examples, passages and observations. Supply source rights and paper alternatives in the sidecar."],
  };
}

export function validateV4Draft(input: unknown, lesson: { grade: number; subject: string; objectives: readonly { id: string; statement: string }[] }) {
  const candidate = parseCandidateLessonV2(JSON.stringify(input));
  if (candidate.contractVersion !== "candidate-lesson-v2/1.1.0") throw new Error("v4_lesson_contract_required");
  const context = { ...lesson, ageBand: ageBandForGrade(lesson.grade) };
  const academic = validateCandidateAgainstContext(candidate, context);
  const standard = evaluateV4Standard(candidate, context);
  const failures = [...academic.errors, ...standard.problems.filter(p => p.severity !== "ADVISORY").map(p => p.code)];
  if (failures.length) throw new Error(`v4_draft_invalid:${[...new Set(failures)].join(";")}`);
  return { candidate, academic, standard };
}

export function buildVisualSidecar(lesson: V4Lesson, candidate: CandidateLessonV2, pins = referenceInputs): VisualTeachingSidecar {
  const blocks = candidate.scenes.flatMap(scene => {
    const slots = [
      ...(scene.teaching?.blocks ?? []).map((block, index) => ({ block, slot: "blocks", index })),
      ...(scene.teaching?.visual ? [{ block: scene.teaching.visual, slot: "visual", index: 0 }] : []),
    ];
    return slots.map(({ block, slot, index }) => {
      const entry = TEACHING_BLOCK_REGISTRY[block.type];
      // Orientation blocks introduce the whole lesson; later blocks use the scene's exact objectives.
      const objectiveIds = scene.objectiveIds.length ? scene.objectiveIds : lesson.objectives.map(o => o.id);
      const alternative = blockTextAlternative(block);
      const signals = misconceptionSignals(block);
      const authorPin = pins.sources.find(p => p.path.endsWith("lessonAuthor.ts"));
      if (!authorPin) throw new Error("author_source_pin_missing");
      return { sceneId: scene.id, slot, index, type: block.type, blockSha256: hash(block), objectiveIds,
        instructionalPurpose: `${entry.purpose} Learner action: ${scene.learnerAction}`,
        misconceptionIds: [...new Set([...scene.misconceptionIds, ...signals.map(s => s.misconceptionId), ...("misconceptionId" in block && block.misconceptionId ? [block.misconceptionId] : [])])],
        responseSignals: signals,
        accessibility: { textAlternative: alternative, keyboardPath: scene.accessibility.keyboardPath,
          nonColorCue: "Use the labels, quantities and text equivalent; color is supplementary.",
          reducedMotion: "Use the static text equivalent and record each model state on paper." },
        offline: { mode: "TEXT_PAPER_CAPTURE_ONLY", instructions: `Read or copy this model: ${alternative}`,
          responsePrompt: `${scene.learnerAction} Write your response and reasoning on paper. Responses are capture only, never official scores.` },
        feedback: { policy: "FORMATIVE_ONLY", reveal: feedbackReveal(block), canonicalMasteryMutation: false },
        sourcePins: [authorPin,
          ...(block.type === "MAP_EXPLORER" ? pins.sources.filter(p => p.path.endsWith("liberiaCounties.ts")) : [])],
      };
    });
  });
  return visualTeachingSidecarSchema.parse({ contractVersion: VISUAL_TEACHING_CONTRACT,
    registryVersion: TEACHING_BLOCK_REGISTRY_VERSION, instructionStandard: V4_INSTRUCTION_STANDARD,
    candidateSha256: hash(candidate), state: "DRAFT", approved: false, published: false, released: false, audience: "REVIEWER_ONLY",
    objectives: lesson.objectives.map(o => ({ id: o.id, statement: o.statement,
      standards: o.moeReferences.map(r => ({ reference: r.moeItemId, statement: r.text, relation: r.relation, mapping: "PROPOSED" })) })),
    blocks, assessmentBoundary: { player: "ASSESSMENT_PLAYER_V2", scoring: "SERVER_AUTHORITY", protectedKeysIncluded: false,
      canonicalMasteryMutation: false, offlineEvidence: "CAPTURE_ONLY_NOT_OFFICIAL" },
  });
}

/** Reviewer metadata only. The renderer reads the frozen registry, never this sidecar. */
export function feedbackReveal(block: VisualBlock): "MODEL" | "NONE" | "AFTER_ATTEMPT" {
  if (block.type === "WORKED_SOLUTION" || block.type === "STEP_REVEAL") return "MODEL";
  if (block.type === "WRITING_ORGANIZER") return "NONE";
  return blockRequiresCompletion(block) ? "AFTER_ATTEMPT" : "NONE";
}

export function validateVisualSidecar(input: unknown, lesson: V4Lesson, candidate: CandidateLessonV2, pins = referenceInputs) {
  const sidecar = visualTeachingSidecarSchema.parse(input);
  if (hash(sidecar) !== hash(buildVisualSidecar(lesson, candidate, pins))) throw new Error("visual_sidecar_binding_mismatch");
  return sidecar;
}

/** Used when protected assessment resources are supplied by their authorized owner. */
export function assertV4AnswerIsolation(candidate: CandidateLessonV2, sidecar: VisualTeachingSidecar,
  assessment: { items: readonly AssessmentItemV2[]; specs: readonly ProtectedScoringSpec[] }) {
  assertLearnerSafe({ candidate, sidecar }, protectedStrings(assessment.items, assessment.specs));
}

export function referenceBlueprint(lesson: V4Lesson, pins = referenceInputs) {
  const objectiveIds = lesson.objectives.map(o => o.id), resourceId = `${lesson.key}-lesson`;
  const pin = { id: "v4-reference-inputs", version: "1.0.0", sha256: hash(pins), sourceRef: pins === referenceInputs ? "curriculum/factory-v4/reference-inputs.json" : "curriculum/factory-v4/draft5-inputs.json" };
  return sealBlueprint({ schemaVersion: UNIT_BLUEPRINT_V4_VERSION, instructionStandard: V4_INSTRUCTION_STANDARD,
    blueprintId: `${lesson.key}-v4`, version: "4.0.0", grade: lesson.grade, subject: lesson.subject, unitId: lesson.key,
    title: lesson.key, repositoryCommit: pins.frontendCommit, sources: [pin],
    objectives: lesson.objectives.map(o => ({ id: o.id, kind: "LIBERIALEARN_MASTERY", statement: o.statement,
      sourceId: pin.id, sourcePointer: o.moeReferences[0].moeItemId, scope: "REQUIRED", mapping: "PROPOSED" })),
    outcomes: [{ id: `${lesson.key}-outcome`, objectiveIds, demonstration: "Produce and explain an independent response and transfer it to a new context." }],
    prerequisites: [], misconceptions: [],
    resources: [{ id: resourceId, kind: "LESSON", role: "LESSON_AUTHOR", objectiveIds, dependsOn: [], audience: "REVIEWER_ONLY" }],
    sequence: [{ resourceId, dependsOn: [], objectiveIds, scaffold: "FULL" }],
    assessmentPlan: [{ id: `${lesson.key}-practice`, resourceId, itemIds: [], kind: "SHORT_CONSTRUCTED_RESPONSE", objectiveIds,
      scaffold: "NONE", timing: "IN_LESSON", context: "REHEARSED", scoring: "NOT_SCORED", source: "EXCELLENCE_PLAN", ref: "REFERENCE_LESSON_ONLY_ASSESSMENT_PENDING" }],
    support: { differentiation: ["Use the text equivalent and paper model with a teacher."], accessibility: ["Scene keyboard paths and block text equivalents."],
      offline: { mode: "TEXT_PAPER_CAPTURE_ONLY", requirements: ["Paper, pencil and printed text alternatives."], maxBytes: 2000000 } },
    provenance: [pin], legacy: [], unresolved: ["REFERENCE_LESSON_ONLY_FULL_EXCELLENCE_PACKAGE_PENDING", "PROTECTED_ASSESSMENT_RECONCILIATION_REQUIRED",
      "PREREQUISITE_DIAGNOSTIC_AND_MISCONCEPTION_ITEM_BINDINGS_PENDING", "AUTHENTIC_SOURCE_COMPARISON_AND_RIGHTS_REVIEW_REQUIRED", "MANUAL_ACCESSIBILITY_AND_OFFLINE_RUNTIME_QA_REQUIRED"],
  });
}

/** Only replaces LESSON_AUTHOR in the existing role pipeline. Other executors and retry/audit machinery remain. */
export function withV4LessonAuthor(executors: FactoryExecutors, author: FactoryExecutors["LESSON_AUTHOR"]): FactoryExecutors {
  return { ...executors, LESSON_AUTHOR: async input => {
    const drafts = await author(input);
    for (const draft of drafts) {
      if (draft.payload.kind !== "LESSON") continue;
      validateV4Draft(draft.payload.candidate, { grade: input.blueprint.grade, subject: input.blueprint.subject, objectives: input.blueprint.objectives });
    }
    return drafts;
  } };
}

export function referenceExecutors(lesson: V4Lesson, author = authorLesson): FactoryExecutors {
  const noop = async (): Promise<ResourceDraft[]> => [];
  const empty: FactoryExecutors = { CURRICULUM_ARCHITECT: noop, LEARNING_SCIENCE_DESIGNER: noop, LESSON_AUTHOR: noop,
    ASSESSMENT_DESIGNER: noop, PROJECT_PRACTICAL_DESIGNER: noop, MEDIA_ACCESSIBILITY: noop, INDEPENDENT_QUALITY_REVIEWER: noop, GOVERNANCE_RELEASE: noop };
  return withV4LessonAuthor(empty, async () => [{ id: `${lesson.key}-lesson`, version: "4.0.0", payload: { kind: "LESSON", candidate: author(lesson) } }]);
}

export { V4_LESSONS };
