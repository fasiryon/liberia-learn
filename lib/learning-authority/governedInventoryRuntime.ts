/**
 * Governed inventory runtime: joins the real template-cell inventory
 * (governed-cell-inventory/1.0.0) to the adaptive loop
 * (governed-learning-evidence/1.0.0 -> masteryWriter -> SLM -> DecisionModel
 * -> Learning Orchestrator).
 *
 *   activity (release item) -> resolveInventoryActivity -> evidence objective
 *   inventory -> inventoryCandidateIds -> orchestrator availableCandidateIds
 *   MOE objective -> resolveObjective -> governed resources or NO_VALID_RESOURCE
 *   decision + SLM states -> teacherDecisionView (reasoning and evidence)
 *
 * This module adds no ranking, scoring or mastery logic. The DecisionModel
 * stays the only next-action handoff; the inventory only restricts which
 * governed candidates exist and names the MOE objective behind each one.
 * Draft lessons never appear here because the inventory excludes them.
 */
import { buildGovernedCellInventory, type GovernedCellInventory, type GovernedInventoryActivity, type GovernedInventoryLesson } from "./governedInventory";
import { GRADE4_MATH_TEMPLATE_CELL } from "./cells/grade4Math";
import { deterministicReleaseIdentity, type CurriculumOntologyRelease } from "./governedGrade4Math";
import type { TemplateCell } from "./templateCell";
import type { LearningDecision, LearningRecommendation } from "./learningOrchestrator";
import type { StudentConceptState } from "@/lib/learning-state/studentLearningModel";

// One cell per released ontology. A release without a cell has no inventory
// and fails closed; the registry never guesses a cell from grade or subject.
const CELLS: readonly TemplateCell[] = Object.freeze([GRADE4_MATH_TEMPLATE_CELL]);
const built = new Map<string, GovernedCellInventory>();

export function governedInventoryForRelease(release: CurriculumOntologyRelease): GovernedCellInventory {
  const identity = deterministicReleaseIdentity(release);
  const cached = built.get(`${release.id}:${identity}`);
  if (cached) return cached;
  const cell = CELLS.find((candidate) => candidate.releaseId === release.id);
  if (!cell) throw new Error("inventory_cell_missing");
  const inventory = buildGovernedCellInventory(cell, release);
  if (inventory.releaseIdentity !== identity) throw new Error("inventory_release_identity_mismatch");
  built.set(`${release.id}:${identity}`, inventory);
  return inventory;
}

/** The governed activity (and so the MOE objective) behind a scored item. Unknown items are refused. */
export function resolveInventoryActivity(inventory: GovernedCellInventory, itemId: string, itemVersion: string): GovernedInventoryActivity {
  const activity = inventory.activities.find((entry) => entry.activityId === itemId && entry.activityVersion === itemVersion);
  if (!activity) throw new Error("inventory_activity_not_governed");
  return activity;
}

/** Orchestrator candidate ids (`<bindingId>:<context>`) for every governed activity. */
export function inventoryCandidateIds(inventory: GovernedCellInventory): readonly string[] {
  return Object.freeze(inventory.activities.map((activity) => `${activity.bindingId}:${activity.evidenceType.toLowerCase()}`).sort());
}

export type ObjectiveResolution =
  | Readonly<{ status: "GOVERNED"; objectiveId: string; conceptIds: readonly string[]; activities: readonly GovernedInventoryActivity[]; lessons: readonly GovernedInventoryLesson[] }>
  | Readonly<{ status: "NO_VALID_RESOURCE"; objectiveId: string; reason: "OBJECTIVE_HAS_NO_REVIEWED_RESOURCE" | "OBJECTIVE_NOT_IN_CELL" }>;

/**
 * What the governed inventory can offer for one MOE objective. An objective
 * with no reviewed concept returns NO_VALID_RESOURCE explicitly, even when a
 * draft lesson exists for it: drafts are not resources.
 */
export function resolveObjective(inventory: GovernedCellInventory, objectiveId: string): ObjectiveResolution {
  const conceptIds = inventory.concepts.filter((concept) => concept.objectiveId === objectiveId).map((concept) => concept.conceptId);
  if (!conceptIds.length) {
    return Object.freeze({ status: "NO_VALID_RESOURCE", objectiveId,
      reason: inventory.uncoveredObjectiveIds.includes(objectiveId) ? "OBJECTIVE_HAS_NO_REVIEWED_RESOURCE" : "OBJECTIVE_NOT_IN_CELL" });
  }
  return Object.freeze({
    status: "GOVERNED", objectiveId, conceptIds,
    activities: inventory.activities.filter((activity) => conceptIds.includes(activity.conceptId)),
    lessons: inventory.lessons.filter((lesson) => lesson.conceptIds.some((id) => conceptIds.includes(id))),
  });
}

export type TeacherDecisionView = Readonly<{
  decisionId: string;
  status: LearningDecision["status"];
  reason: LearningDecision["reason"];
  release: Readonly<{ id: string; identity: string; moeApprovalState: "NOT_CLAIMED" }>;
  action: Readonly<{ candidateId: string; kind: "DIAGNOSTIC" | "PRACTICE"; conceptId: string; objectiveId: string; objectiveBasis: GovernedInventoryActivity["objectiveBasis"]; activityId: string; activityVersion: string }> | null;
  lesson: GovernedInventoryLesson | null;
  ranking: Readonly<{ modelId: string; fallbackReason: string | null; rankedCandidates: LearningRecommendation["rankedCandidates"] }>;
  evidence: readonly Readonly<{
    conceptId: string; objectiveId: string; eventCount: number; observedScore: number | null;
    masteryLevel: string; confidence: string; retention: string; conflict: boolean;
    misconceptions: readonly string[]; explanation: readonly string[];
  }>[];
}>;

/** Teacher-visible reasoning for one decision: the governed action, its objective, and the evidence behind it. */
export function teacherDecisionView(input: {
  inventory: GovernedCellInventory;
  decision: LearningDecision;
  recommendation: LearningRecommendation;
  states: readonly StudentConceptState[];
}): TeacherDecisionView {
  const { inventory, decision, recommendation } = input;
  if (decision.ontologyReleaseId !== inventory.releaseId || decision.ontologyReleaseIdentity !== inventory.releaseIdentity) {
    throw new Error("teacher_view_release_mismatch");
  }
  const objectiveOf = (conceptId: string) => {
    const concept = inventory.concepts.find((entry) => entry.conceptId === conceptId);
    if (!concept) throw new Error("teacher_view_concept_not_governed");
    return concept;
  };
  let action: TeacherDecisionView["action"] = null;
  let lesson: GovernedInventoryLesson | null = null;
  if (decision.action) {
    // Release item ids are unique within a release, so the action's itemId names one activity.
    const itemId = decision.action.itemId;
    const activity = inventory.activities.find((entry) => entry.activityId === itemId);
    if (!activity) throw new Error("inventory_activity_not_governed");
    action = Object.freeze({ candidateId: decision.action.id, kind: decision.action.kind, conceptId: activity.conceptId,
      objectiveId: activity.objectiveId, objectiveBasis: activity.objectiveBasis, activityId: activity.activityId, activityVersion: activity.activityVersion });
    lesson = inventory.lessons.find((entry) => entry.conceptIds.includes(activity.conceptId)) ?? null;
  }
  return Object.freeze({
    decisionId: decision.id, status: decision.status, reason: decision.reason,
    release: Object.freeze({ id: inventory.releaseId, identity: inventory.releaseIdentity, moeApprovalState: inventory.moeApprovalState }),
    action, lesson,
    ranking: Object.freeze({ modelId: recommendation.modelId, fallbackReason: recommendation.fallbackReason, rankedCandidates: recommendation.rankedCandidates }),
    evidence: Object.freeze(input.states.map((state) => Object.freeze({
      conceptId: state.scope.conceptId, objectiveId: objectiveOf(state.scope.conceptId).objectiveId,
      eventCount: state.replay.eventCount, observedScore: state.mastery.observedScore, masteryLevel: state.mastery.level,
      confidence: state.confidence.level, retention: state.retention.status, conflict: state.conflict.present,
      misconceptions: state.misconceptions.map((entry) => `${entry.signalId}:${entry.status}`), explanation: state.teacherExplanation,
    }))),
  });
}
