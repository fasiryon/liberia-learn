/**
 * Compatibility adapters between Assessment V2 and existing systems. Adapters only translate and
 * check pins; they never approve, release or score.
 *
 *   ContentBundle V1 AssessmentReference → exact definition/item pins checked against V2 content
 *   Curriculum Excellence G7 candidate tasks → CANDIDATE items with protected specs (AI-authored,
 *     unreviewed; they stay candidates until a qualified human reviews the exact hash)
 *   Legacy Exam / ExamQuestion rows → learner-safe projection and IMPORTED_LEGACY candidates
 */
import { sealItem } from "./hash";
import type { AssessmentReference } from "@/lib/content-bundle/v1/types";
import type {
  AssessmentDefinitionV2,
  AssessmentItemV2,
  AssessmentPurpose,
  CognitiveDemand,
  ItemContext,
  ProtectedScoringSpec,
  Rubric,
} from "./types";

// ─── ContentBundle V1 ───────────────────────────────────────────────────────────────────────────

export type BundleAssessmentResolution = Readonly<{
  definition: AssessmentDefinitionV2;
  items: readonly AssessmentItemV2[];
}>;

/**
 * Resolves a bundle's governed pointer by exact version only (never "latest", never by title) and
 * checks that the bundle's objectives are a subset of what the V2 definition measures.
 */
export function resolveBundleAssessmentReference(
  reference: AssessmentReference,
  registry: Readonly<{
    definitions: ReadonlyMap<string, AssessmentDefinitionV2>;
    items: ReadonlyMap<string, AssessmentItemV2>;
  }>,
): BundleAssessmentResolution {
  const definition = registry.definitions.get(`${reference.definition.definitionId}@${reference.definition.definitionVersion}`);
  if (!definition) throw new Error("assessment_bundle_definition_unresolved");
  for (const objectiveId of reference.objectiveIds) {
    if (!definition.objectiveIds.includes(objectiveId)) throw new Error("assessment_bundle_objective_not_measured");
  }
  const items = reference.items.map((ref) => {
    const item = registry.items.get(`${ref.assessmentItemId}@${ref.assessmentItemVersion}`);
    if (!item) throw new Error("assessment_bundle_item_unresolved");
    return item;
  });
  return Object.freeze({ definition, items: Object.freeze(items) });
}

// ─── Curriculum Excellence G7 candidate tasks ───────────────────────────────────────────────────

/** Shape of `curriculum/v2/g7/assessment-definitions/*.json` tasks (PR #191, v0.3.0 candidates). */
export type G7CandidateTask = Readonly<{
  id: string;
  kind: "PREREQUISITE_DIAGNOSTIC" | "SHORT_CONSTRUCTED_RESPONSE" | "EXTENDED_REASONING" | "TRANSFER_TASK" | "DELAYED_RETRIEVAL" | "EXTENSION" | string;
  objectiveIds: readonly string[];
  scaffold?: string;
  timing?: string;
  delayDays?: number;
  context?: "REHEARSED" | "NEW" | string;
  scoring: "KEYED" | "ANALYTIC_RUBRIC" | string;
  prompt: string;
  key?: string;
  scoringGuide?: Readonly<Record<string, string>>;
  targetsMisconceptions?: readonly string[];
}>;

export type G7CandidateFile = Readonly<{
  lessonKey: string;
  status: string;
  authors: readonly Readonly<{ kind: string; agentId?: string }>[];
  tasks: readonly G7CandidateTask[];
}>;

const G7_KIND: Record<string, { purpose: AssessmentPurpose; demand: CognitiveDemand; itemType: AssessmentItemV2["itemType"] }> = {
  PREREQUISITE_DIAGNOSTIC: { purpose: "DIAGNOSTIC", demand: "RECALL", itemType: "SHORT_CONSTRUCTED" },
  SHORT_CONSTRUCTED_RESPONSE: { purpose: "FORMATIVE", demand: "APPLY", itemType: "SHORT_CONSTRUCTED" },
  EXTENDED_REASONING: { purpose: "FORMATIVE", demand: "ANALYZE", itemType: "WORKED_SOLUTION" },
  TRANSFER_TASK: { purpose: "TRANSFER", demand: "APPLY", itemType: "WORKED_SOLUTION" },
  DELAYED_RETRIEVAL: { purpose: "RETENTION", demand: "UNDERSTAND", itemType: "WORKED_SOLUTION" },
  EXTENSION: { purpose: "FORMATIVE", demand: "CREATE", itemType: "WORKED_SOLUTION" },
};

export type G7CandidateItem = Readonly<{
  item: AssessmentItemV2;
  spec: ProtectedScoringSpec;
  purpose: AssessmentPurpose;
  delayDays: number | null;
  /** Always CANDIDATE: adapting content never confers review or release status. */
  status: "CANDIDATE";
}>;

function rubricFromGuide(taskId: string, guide: Readonly<Record<string, string>>): Rubric {
  const levels = Object.entries(guide)
    .map(([points, descriptor]) => ({ points: Number(points), descriptor }))
    .filter((level) => Number.isInteger(level.points) && level.points >= 0)
    .sort((a, b) => a.points - b.points);
  return { rubricId: `${taskId}-rubric`, rubricVersion: "candidate-0", criteria: [{ criterionId: "overall", title: "Overall", levels }] };
}

export function adaptG7CandidateTasks(file: G7CandidateFile, input: { version: string; sourceRef: string }): readonly G7CandidateItem[] {
  const authors = file.authors.map((author) => ({
    kind: author.kind === "AI" ? ("AI" as const) : ("HUMAN" as const),
    id: author.agentId ?? "unknown-author",
  }));
  if (authors.length === 0) throw new Error("assessment_candidate_authors_required");
  return Object.freeze(file.tasks.map((task) => {
    const mapping = G7_KIND[task.kind];
    if (!mapping) throw new Error(`assessment_candidate_kind_unmapped:${task.kind}`);
    const rubric = task.scoringGuide ? rubricFromGuide(task.id, task.scoringGuide) : null;
    const keyed = task.scoring === "KEYED" && typeof task.key === "string";
    // Keyed candidate answers are written for paper/teacher use ("3 → 30,000; 4 → 0.04"), so they
    // are held for human scoring rather than exact-match auto-scoring.
    const itemType = rubric ? mapping.itemType : "SHORT_CONSTRUCTED";
    const key: ProtectedScoringSpec["key"] = rubric
      ? { kind: "RUBRIC", rubric }
      : { kind: "SHORT_CONSTRUCTED", acceptedAnswers: keyed ? [task.key!] : [], autoScore: "HUMAN_ONLY" };
    if (!rubric && !keyed) throw new Error(`assessment_candidate_key_missing:${task.id}`);
    const maxPoints = rubric ? Math.max(...rubric.criteria[0].levels.map((level) => level.points)) : 1;
    const spec: ProtectedScoringSpec = Object.freeze({
      schemaVersion: "assessment.v2",
      itemId: `${file.lessonKey}:${task.id}`,
      itemVersion: input.version,
      scoringVersion: "candidate-0",
      maxPoints,
      key,
      explanation: rubric && keyed ? `Reference answer: ${task.key}` : null,
      misconceptionSignals: [],
      moderationNotes: [],
    });
    const context: ItemContext = task.context === "NEW" ? "NEW" : "REHEARSED";
    const item = sealItem({
      schemaVersion: "assessment.v2",
      itemId: spec.itemId,
      version: input.version,
      itemType,
      stimulus: {
        prompt: task.prompt, context: null, resourceIds: [], options: [], orderingElements: [],
        matchingLeft: [], matchingRight: [], expectedUnit: null, learnerVisibleCriteria: [],
      },
      objectiveIds: [...task.objectiveIds],
      misconceptionIds: [...(task.targetsMisconceptions ?? [])],
      difficulty: mapping.demand === "RECALL" ? 1 : mapping.demand === "APPLY" || mapping.demand === "UNDERSTAND" ? 3 : 4,
      cognitiveDemand: mapping.demand,
      context,
      hints: [],
      feedbackPolicy: { hints: "NONE", explanation: "AFTER_ATTEMPT_CLOSED", correctAnswer: "AFTER_ATTEMPT_CLOSED" },
      provenance: { authors, sourceRef: `${input.sourceRef}#${task.id}`, curriculumSourceRefs: [] },
    }, spec);
    return Object.freeze({ item, spec, purpose: mapping.purpose, delayDays: task.delayDays ?? null, status: "CANDIDATE" as const });
  }));
}

// ─── Legacy Exam / ExamQuestion ─────────────────────────────────────────────────────────────────

type LegacyExamQuestion = Readonly<{
  id: string;
  examId: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  moeCode: string;
  points: number;
}>;

export type LegacyLearnerExamQuestion = Readonly<{ id: string; examId: string; prompt: string; options: readonly string[]; moeCode: string; points: number }>;

/**
 * Allow-list projection for the legacy student exam routes. The previous deny-list removed
 * `correctIndex` but still sent `explanation` (worked answer) before submission.
 */
export function projectLegacyExamQuestionForLearner(question: LegacyExamQuestion): LegacyLearnerExamQuestion {
  return Object.freeze({
    id: question.id,
    examId: question.examId,
    prompt: question.prompt,
    options: [...question.options],
    moeCode: question.moeCode,
    points: question.points,
  });
}

/** Imports a legacy question as an unreviewed V2 candidate with the key moved into a protected spec. */
export function legacyExamQuestionToCandidate(question: LegacyExamQuestion, input: { version: string; createdBy: string; grade: number }): Readonly<{ item: AssessmentItemV2; spec: ProtectedScoringSpec; status: "CANDIDATE" }> {
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) throw new Error("assessment_legacy_key_invalid");
  const itemId = `legacy-exam:${question.examId}:${question.id}`;
  const options = question.options.map((text, index) => ({ optionId: `o${index}`, text }));
  const spec: ProtectedScoringSpec = Object.freeze({
    schemaVersion: "assessment.v2", itemId, itemVersion: input.version, scoringVersion: "legacy-import-1",
    maxPoints: question.points, key: { kind: "SINGLE_SELECT" as const, correctOptionId: `o${question.correctIndex}` },
    explanation: question.explanation || null, misconceptionSignals: [], moderationNotes: [],
  });
  const item = sealItem({
    schemaVersion: "assessment.v2", itemId, version: input.version, itemType: "SINGLE_SELECT",
    stimulus: { prompt: question.prompt, context: null, resourceIds: [], options, orderingElements: [], matchingLeft: [], matchingRight: [], expectedUnit: null, learnerVisibleCriteria: [] },
    objectiveIds: [question.moeCode], misconceptionIds: [], difficulty: 3, cognitiveDemand: "UNDERSTAND", context: "REHEARSED",
    hints: [], feedbackPolicy: { hints: "NONE", explanation: "AFTER_ATTEMPT_CLOSED", correctAnswer: "AFTER_ATTEMPT_CLOSED" },
    provenance: { authors: [{ kind: "IMPORTED_LEGACY", id: input.createdBy }], sourceRef: `ExamQuestion:${question.id}`, curriculumSourceRefs: [question.moeCode] },
  }, spec);
  return Object.freeze({ item, spec, status: "CANDIDATE" as const });
}
