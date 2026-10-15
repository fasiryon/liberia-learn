/**
 * Subject assessment blueprints (Curriculum Excellence Standard V1).
 *
 * A blueprint says what evidence a lesson must plan before LiberiaLearn may call an objective
 * mastered. Selected response is allowed, and useful for misconception diagnosis, but where
 * productive reasoning or performance is central it can never be the only mastery evidence:
 * a learner who picks the right option has not shown they can explain, produce or write it.
 *
 * Evidence comes from two places, both bound to an exact candidate revision:
 *   CANDIDATE        derived from the Curriculum V2 candidate and its reviewer-only exit items;
 *   EXCELLENCE_PLAN  a separate assessment plan proposed for that revision (the V2 contract has no
 *                    fields for prerequisite links, delayed retrieval or transfer, so the plan
 *                    carries them without changing the generator contract).
 *
 * This module only evaluates plans. It creates no items, scores nothing and writes nothing.
 */
import type { CandidateLessonV2, ScaffoldLevel } from "@/lib/curriculum/v2/contract";
import type { ExcellenceLayer } from "./standard";

export const ASSESSMENT_BLUEPRINT_VERSION = "liberialearn-assessment-blueprint/1.0.0" as const;

export const ASSESSMENT_EVIDENCE_KINDS = [
  "SELECTED_RESPONSE", "SHORT_CONSTRUCTED_RESPONSE", "EXTENDED_REASONING", "ORIGINAL_WRITING", "PERFORMANCE_TASK",
  "PREREQUISITE_DIAGNOSTIC", "DELAYED_RETRIEVAL", "TRANSFER_TASK", "EXTENSION",
] as const;
export type AssessmentEvidenceKind = (typeof ASSESSMENT_EVIDENCE_KINDS)[number];

export type TaskTiming = "PRE_LESSON" | "IN_LESSON" | "END_OF_LESSON" | "DELAYED";

export type PlannedAssessmentTask = Readonly<{
  id: string;
  kind: AssessmentEvidenceKind;
  objectiveIds: readonly string[];
  scaffold: ScaffoldLevel;
  timing: TaskTiming;
  /** Required for DELAYED tasks. */
  delayDays?: number;
  context: "REHEARSED" | "NEW";
  scoring: "KEYED" | "ANALYTIC_RUBRIC" | "NOT_SCORED";
  /** Index into candidate.prerequisiteAssumptions, for PREREQUISITE_DIAGNOSTIC tasks. */
  prerequisiteIndex?: number;
  /** What the teacher or runtime does when the diagnostic shows the prerequisite is missing. */
  fallbackRoute?: string;
  optional?: boolean;
  source: "CANDIDATE" | "EXCELLENCE_PLAN";
  /** JSON pointer (candidate/assessment document) or plan id the task comes from. */
  ref: string;
}>;

export type ExitItemRecord = Readonly<{
  objectiveId: string;
  item: Readonly<{ id: string; options: readonly string[] }>;
}>;

const SELECTED_INTERACTIONS = new Set(["SINGLE_CHOICE", "MULTI_SELECT", "MATCHING", "ORDERING", "DIAGRAM_LABELING", "DRAG_DROP"]);

export type SubjectFamily = "MATH" | "LITERACY" | "DEFAULT";

export function subjectFamily(subject: string): SubjectFamily {
  const key = subject.trim().toUpperCase();
  if (key === "MATH" || key === "MATHEMATICS") return "MATH";
  if (key === "LITERACY" || key === "ENGLISH" || key === "LANGUAGE_ARTS") return "LITERACY";
  return "DEFAULT";
}

/**
 * The assessment evidence a candidate revision already plans. Practice is IN_LESSON (formative);
 * only END_OF_LESSON and DELAYED tasks at scaffold NONE count as mastery evidence.
 */
export function deriveCandidateTasks(candidate: CandidateLessonV2, subject: string, exitItems: readonly ExitItemRecord[]): PlannedAssessmentTask[] {
  const family = subjectFamily(subject);
  const tasks: PlannedAssessmentTask[] = [];
  candidate.scenes.forEach((scene, sceneIndex) => {
    if (scene.evidence.kind === "NONE" || scene.evidence.kind === "REFLECTION") return;
    if (scene.evidence.kind === "MASTERY_RESPONSE") return; // represented by its exit items below
    scene.evidence.responses.forEach((response, responseIndex) => {
      const kind: AssessmentEvidenceKind =
        response.responseType === "TEXT" ? (family === "LITERACY" ? "ORIGINAL_WRITING" : "SHORT_CONSTRUCTED_RESPONSE")
        : response.responseType === "NUMBER" ? "SHORT_CONSTRUCTED_RESPONSE"
        : "SELECTED_RESPONSE";
      tasks.push({
        id: `${scene.id}#${response.responseKey}`, kind, objectiveIds: [response.objectiveId], scaffold: response.scaffoldLevel,
        timing: "IN_LESSON", context: "REHEARSED", scoring: kind === "SELECTED_RESPONSE" ? "KEYED" : "NOT_SCORED",
        source: "CANDIDATE", ref: `/scenes/${sceneIndex}/evidence/responses/${responseIndex}`,
      });
    });
  });
  candidate.assessmentRequests.forEach((request, requestIndex) => {
    const items = exitItems.filter((record) => request.objectiveIds.includes(record.objectiveId));
    const kind: AssessmentEvidenceKind = request.evidenceType === "DIAGNOSTIC" ? "PREREQUISITE_DIAGNOSTIC"
      : SELECTED_INTERACTIONS.has(request.interaction) ? "SELECTED_RESPONSE"
      : request.interaction === "NUMERIC" ? "SHORT_CONSTRUCTED_RESPONSE"
      : family === "LITERACY" ? "ORIGINAL_WRITING" : "EXTENDED_REASONING";
    const timing: TaskTiming = request.evidenceType === "DIAGNOSTIC" ? "PRE_LESSON" : "END_OF_LESSON";
    if (items.length === 0) {
      tasks.push({ id: request.id, kind, objectiveIds: [...request.objectiveIds], scaffold: "NONE", timing, context: "REHEARSED",
        scoring: kind === "SELECTED_RESPONSE" ? "KEYED" : "ANALYTIC_RUBRIC", source: "CANDIDATE", ref: `/assessmentRequests/${requestIndex}` });
      return;
    }
    for (const record of items) {
      tasks.push({ id: record.item.id, kind, objectiveIds: [record.objectiveId], scaffold: "NONE", timing, context: "REHEARSED",
        scoring: kind === "SELECTED_RESPONSE" ? "KEYED" : "ANALYTIC_RUBRIC", source: "CANDIDATE", ref: `assessment:${record.item.id}` });
    }
  });
  return tasks;
}

export type BlueprintRuleResult = Readonly<{
  ruleId: string;
  criterionId: string;
  layer: ExcellenceLayer;
  blocking: boolean;
  met: boolean;
  requirement: string;
  detail: string;
  missing: readonly string[];
}>;

export type BlueprintEvaluation = Readonly<{
  version: typeof ASSESSMENT_BLUEPRINT_VERSION;
  family: SubjectFamily;
  rules: readonly BlueprintRuleResult[];
  selectedResponseShareOfMastery: number | null;
  blockingGaps: readonly string[];
}>;

const isMastery = (task: PlannedAssessmentTask) =>
  !task.optional && task.scaffold === "NONE" && (task.timing === "END_OF_LESSON" || task.timing === "DELAYED");

type Blueprint = Readonly<{
  maxSelectedShare: number;
  /** Mastery evidence that must exist for every objective, by subject. */
  productionKinds: readonly AssessmentEvidenceKind[];
  productionLabel: string;
  reasoningRequired: boolean;
}>;

export const SUBJECT_BLUEPRINTS: Readonly<Record<SubjectFamily, Blueprint>> = Object.freeze({
  // Number sense: learners must produce numbers and justify comparisons, not only recognise them.
  MATH: { maxSelectedShare: 0.6, productionKinds: ["SHORT_CONSTRUCTED_RESPONSE", "EXTENDED_REASONING", "PERFORMANCE_TASK"], productionLabel: "a produced answer or justification (not a selected option)", reasoningRequired: true },
  // Writing objectives are evidenced by writing: an original, unscaffolded piece scored with an analytic rubric.
  LITERACY: { maxSelectedShare: 0.5, productionKinds: ["ORIGINAL_WRITING"], productionLabel: "original unscaffolded writing scored with an analytic rubric", reasoningRequired: true },
  DEFAULT: { maxSelectedShare: 0.6, productionKinds: ["SHORT_CONSTRUCTED_RESPONSE", "EXTENDED_REASONING", "PERFORMANCE_TASK", "ORIGINAL_WRITING"], productionLabel: "a constructed response or performance", reasoningRequired: true },
});

export function evaluateAssessmentBlueprint(input: {
  subject: string;
  objectiveIds: readonly string[];
  prerequisiteCount: number;
  tasks: readonly PlannedAssessmentTask[];
}): BlueprintEvaluation {
  const family = subjectFamily(input.subject);
  const blueprint = SUBJECT_BLUEPRINTS[family];
  const mastery = input.tasks.filter(isMastery);
  const endOfLesson = mastery.filter((task) => task.timing === "END_OF_LESSON");
  const rules: BlueprintRuleResult[] = [];
  const rule = (result: Omit<BlueprintRuleResult, "met"> & { met?: boolean }) =>
    rules.push(Object.freeze({ ...result, met: result.met ?? result.missing.length === 0, missing: Object.freeze([...result.missing]) }));
  const covers = (objectiveId: string, predicate: (task: PlannedAssessmentTask) => boolean) =>
    input.tasks.some((task) => predicate(task) && task.objectiveIds.includes(objectiveId));

  rule({ ruleId: "BP-COVERAGE", criterionId: "NF-ASM-1", layer: "NATIONAL_FOUNDATION", blocking: true,
    requirement: "Every objective has end-of-lesson mastery evidence at scaffold NONE.",
    missing: input.objectiveIds.filter((id) => !covers(id, (task) => isMastery(task) && task.timing === "END_OF_LESSON")),
    detail: `${endOfLesson.length} end-of-lesson mastery task(s).` });

  const diagnosed = new Set(input.tasks.filter((task) => task.kind === "PREREQUISITE_DIAGNOSTIC" && task.prerequisiteIndex !== undefined && task.fallbackRoute?.trim()).map((task) => task.prerequisiteIndex));
  rule({ ruleId: "BP-PREREQUISITE-DIAGNOSTIC", criterionId: "NF-PRG-1", layer: "NATIONAL_FOUNDATION", blocking: true,
    requirement: "Every stated prerequisite has a diagnostic task with a fallback route.",
    missing: Array.from({ length: input.prerequisiteCount }, (_, index) => index).filter((index) => !diagnosed.has(index)).map((index) => `prerequisite[${index}]`),
    detail: `${diagnosed.size} of ${input.prerequisiteCount} prerequisite(s) diagnosed.` });

  rule({ ruleId: "BP-INDEPENDENT-PRACTICE", criterionId: "LM-PRG-1", layer: "LIBERIALEARN_MASTERY", blocking: true,
    requirement: "Every objective reaches unscaffolded practice before mastery evidence.",
    missing: input.objectiveIds.filter((id) => !covers(id, (task) => task.timing === "IN_LESSON" && task.scaffold === "NONE")),
    detail: "Formative IN_LESSON tasks at scaffold NONE." });

  rule({ ruleId: "BP-PRODUCTION", criterionId: "LM-ASM-1", layer: "LIBERIALEARN_MASTERY", blocking: true,
    requirement: `Every objective has mastery evidence that is ${blueprint.productionLabel}.`,
    missing: input.objectiveIds.filter((id) => !covers(id, (task) => isMastery(task) && blueprint.productionKinds.includes(task.kind) && task.scoring !== "NOT_SCORED")),
    detail: `Accepted kinds: ${blueprint.productionKinds.join(", ")}.` });

  const reasoning = mastery.filter((task) => task.kind === "EXTENDED_REASONING" || (family === "LITERACY" && task.kind === "ORIGINAL_WRITING"));
  rule({ ruleId: "BP-REASONING", criterionId: "LM-RSN-1", layer: "LIBERIALEARN_MASTERY", blocking: blueprint.reasoningRequired,
    requirement: "At least one unscaffolded, rubric-scored reasoning or justification task.",
    missing: reasoning.some((task) => task.scoring === "ANALYTIC_RUBRIC") ? [] : ["EXTENDED_REASONING"],
    detail: `${reasoning.length} reasoning task(s) at mastery.` });

  const selected = endOfLesson.filter((task) => task.kind === "SELECTED_RESPONSE").length;
  const share = endOfLesson.length ? selected / endOfLesson.length : null;
  rule({ ruleId: "BP-SELECTED-SHARE", criterionId: "LM-ASM-1", layer: "LIBERIALEARN_MASTERY", blocking: true,
    requirement: `Selected response is at most ${Math.round(blueprint.maxSelectedShare * 100)}% of end-of-lesson mastery evidence.`,
    missing: share === null || share > blueprint.maxSelectedShare ? ["SELECTED_RESPONSE_SHARE"] : [],
    detail: share === null ? "No end-of-lesson mastery evidence." : `${selected}/${endOfLesson.length} selected response (${Math.round(share * 100)}%).` });

  rule({ ruleId: "BP-RETENTION", criterionId: "LM-ASM-3", layer: "LIBERIALEARN_MASTERY", blocking: true,
    requirement: "Every objective has delayed retrieval at least 7 days after the lesson.",
    missing: input.objectiveIds.filter((id) => !covers(id, (task) => task.kind === "DELAYED_RETRIEVAL" && task.timing === "DELAYED" && (task.delayDays ?? 0) >= 7 && task.scaffold === "NONE")),
    detail: "Spaced retrieval, unscaffolded." });

  rule({ ruleId: "BP-TRANSFER", criterionId: "GE-TRN-1", layer: "GLOBAL_EXCELLENCE", blocking: true,
    requirement: "At least one unscaffolded transfer task in a context the lesson did not rehearse.",
    missing: input.tasks.some((task) => task.kind === "TRANSFER_TASK" && task.context === "NEW" && task.scaffold === "NONE") ? [] : ["TRANSFER_TASK"],
    detail: "Near or far transfer, NEW context." });

  rule({ ruleId: "BP-EXTENSION", criterionId: "GE-EXT-1", layer: "GLOBAL_EXCELLENCE", blocking: true,
    requirement: "An optional, non-gating extension task.",
    missing: input.tasks.some((task) => task.kind === "EXTENSION" && task.optional === true) ? [] : ["EXTENSION"],
    detail: "Extension is optional and never required for mastery." });

  return Object.freeze({
    version: ASSESSMENT_BLUEPRINT_VERSION,
    family,
    rules: Object.freeze(rules),
    selectedResponseShareOfMastery: share,
    blockingGaps: Object.freeze(rules.filter((item) => item.blocking && !item.met).map((item) => item.ruleId)),
  });
}
