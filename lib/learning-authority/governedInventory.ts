/**
 * Governed cell inventory contract (governed-cell-inventory/1.0.0).
 *
 * The exact, governed-only view of a template cell that the adaptive
 * intelligence layer (Learning Orchestrator / governed-learning-evidence,
 * PR #149) consumes. It contains only what is released and reviewed:
 * release items + construct bindings, GOVERNED lessons, and the MOE
 * objective each concept is grounded in. DRAFT_UNREVIEWED lessons are
 * counted in `excluded` and never appear as resources.
 *
 * Mapping to governed-learning-evidence/1.0.0:
 *   evidence.objective.conceptId        = activity.conceptId
 *   evidence.objective.objectiveId      = activity.objectiveId
 *   evidence.activity.activityId        = activity.activityId       (release item id)
 *   evidence.activity.activityVersion   = activity.activityVersion  (release item version)
 *   evidence.evidenceType               = activity.evidenceType
 *   evidence.curriculum.ontologyReleaseId       = inventory.releaseId
 *   evidence.curriculum.ontologyReleaseIdentity = inventory.releaseIdentity
 *   evidence.strength.policyRef         = activity.evidencePolicyId
 */
import { deterministicReleaseIdentity, validateOntologyRelease, type CurriculumOntologyRelease } from "./governedGrade4Math";
import type { TemplateCell } from "./templateCell";

export const GOVERNED_CELL_INVENTORY_VERSION = "governed-cell-inventory/1.0.0" as const;
export const EXTENSION_OBJECTIVE_PREFIX = "LIBERIALEARN_EXTENSION:";

export type GovernedInventoryActivity = Readonly<{
  activityId: string;
  activityVersion: string;
  evidenceType: "DIAGNOSTIC" | "PRACTICE";
  bindingId: string;
  conceptId: string;
  /** MOE structured objective id, or LIBERIALEARN_EXTENSION:<conceptId> for extension concepts. */
  objectiveId: string;
  objectiveBasis: "MOE_OBJECTIVE" | "LIBERIALEARN_EXTENSION";
  evidencePolicyId: string;
  toolPolicyId: string;
}>;

export type GovernedInventoryLesson = Readonly<{ contentId: string; version: string; conceptIds: readonly string[]; objectiveIds: readonly string[]; toolPolicyId: string }>;

export type GovernedCellInventory = Readonly<{
  contractVersion: typeof GOVERNED_CELL_INVENTORY_VERSION;
  cellId: string;
  grade: number;
  subject: string;
  releaseId: string;
  releaseIdentity: string;
  moeApprovalState: "NOT_CLAIMED";
  concepts: readonly Readonly<{ conceptId: string; objectiveId: string; objectiveBasis: "MOE_OBJECTIVE" | "LIBERIALEARN_EXTENSION"; prerequisiteConceptIds: readonly string[] }>[];
  activities: readonly GovernedInventoryActivity[];
  lessons: readonly GovernedInventoryLesson[];
  /** MOE objectives with no governed concept yet: the orchestrator must return NO_VALID_RESOURCE for them. */
  uncoveredObjectiveIds: readonly string[];
  excluded: Readonly<{ draftLessons: number; reason: "DRAFT_UNREVIEWED is never governed inventory" }>;
}>;

export function buildGovernedCellInventory(cell: TemplateCell, release: CurriculumOntologyRelease): GovernedCellInventory {
  validateOntologyRelease(release);
  if (cell.releaseId !== release.id || cell.grade !== release.grade || cell.subject !== release.subject) throw new Error("inventory_cell_release_mismatch");
  if (cell.authority.moeApprovalState !== "NOT_CLAIMED") throw new Error("inventory_moe_claim_without_evidence");

  const conceptObjective = new Map<string, { objectiveId: string; objectiveBasis: "MOE_OBJECTIVE" | "LIBERIALEARN_EXTENSION" }>();
  for (const concept of release.concepts) {
    const link = cell.conceptLinks.find((entry) => entry.conceptId === concept.id);
    if (!link) throw new Error(`inventory_concept_unlinked:${concept.id}`);
    if (link.basis === "LIBERIALEARN_EXTENSION") {
      conceptObjective.set(concept.id, { objectiveId: `${EXTENSION_OBJECTIVE_PREFIX}${concept.id}`, objectiveBasis: "LIBERIALEARN_EXTENSION" });
    } else {
      // The evidence envelope carries one objective id per concept.
      if (link.moeObjectiveIds.length !== 1) throw new Error(`inventory_concept_objective_ambiguous:${concept.id}`);
      conceptObjective.set(concept.id, { objectiveId: link.moeObjectiveIds[0]!, objectiveBasis: "MOE_OBJECTIVE" });
    }
  }

  const items = new Map(release.items.map((item) => [item.id, item]));
  const activities: GovernedInventoryActivity[] = release.bindings.map((binding) => {
    const item = items.get(binding.itemId)!;
    const objective = conceptObjective.get(binding.conceptId)!;
    return {
      activityId: item.id, activityVersion: item.version, evidenceType: item.context, bindingId: binding.id,
      conceptId: binding.conceptId, ...objective, evidencePolicyId: binding.evidencePolicyId, toolPolicyId: binding.toolPolicyId,
    };
  }).sort((a, b) => a.activityId.localeCompare(b.activityId));

  const governedLessons = cell.units.flatMap((unit) => unit.lessons.filter((lesson) => lesson.authority === "GOVERNED"));
  const lessons: GovernedInventoryLesson[] = governedLessons.map((lesson) => {
    const binding = release.contentBindings.find((entry) => entry.contentId === lesson.contentId && entry.contentVersion === lesson.version);
    if (!binding) throw new Error(`inventory_governed_lesson_not_released:${lesson.contentId}`);
    return { contentId: lesson.contentId, version: lesson.version, conceptIds: lesson.conceptIds, objectiveIds: lesson.objectiveIds, toolPolicyId: binding.toolPolicyId };
  }).sort((a, b) => a.contentId.localeCompare(b.contentId));

  const governedObjectives = new Set([...conceptObjective.values()].map((entry) => entry.objectiveId));
  const allObjectives = cell.units.flatMap((unit) => unit.objectives.map((objective) => objective.moeItemId));
  return {
    contractVersion: GOVERNED_CELL_INVENTORY_VERSION,
    cellId: cell.id,
    grade: cell.grade,
    subject: cell.subject,
    releaseId: release.id,
    releaseIdentity: deterministicReleaseIdentity(release),
    moeApprovalState: "NOT_CLAIMED",
    concepts: release.concepts.map((concept) => ({
      conceptId: concept.id,
      ...conceptObjective.get(concept.id)!,
      prerequisiteConceptIds: release.prerequisites.filter((edge) => edge.toConceptId === concept.id).map((edge) => edge.fromConceptId).sort(),
    })),
    activities,
    lessons,
    uncoveredObjectiveIds: allObjectives.filter((id) => !governedObjectives.has(id)).sort(),
    excluded: {
      draftLessons: cell.units.reduce((n, unit) => n + unit.lessons.filter((lesson) => lesson.authority === "DRAFT_UNREVIEWED").length, 0),
      reason: "DRAFT_UNREVIEWED is never governed inventory",
    },
  };
}
