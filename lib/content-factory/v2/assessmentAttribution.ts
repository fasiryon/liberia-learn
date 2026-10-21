import type { AuthoringInput } from "./authoringInput";
import { parseBlueprint } from "./blueprint";

/** Item primary objectives stated by the author for multi-objective tasks (ids only). */
export type StatedPrimaryObjectives = Readonly<Record<string, Readonly<Record<string, string>>>>;

type Item = { itemId: string; objectiveIds: string[] };
const itemsOf = (input: AuthoringInput): Item[] => input.resources.flatMap(resource => {
  const items = (resource.payload as { items?: unknown }).items;
  return Array.isArray(items) ? items as Item[] : [];
});

/**
 * Founder decision D7 (C12). Item objective tags remain a factory coverage constraint (quality.ts superset rule).
 * Single-objective scored tasks keep item-level attribution. Multi-objective scored tasks report at task level only,
 * because item tags cannot attribute evidence to one objective. Items outside the plan, and items whose stated primary
 * objective the task does not declare, are unattributed and block release.
 */
export function assessmentAttribution(input: AuthoringInput, statedPrimary: StatedPrimaryObjectives = {}) {
  const plan = parseBlueprint(input.blueprint).assessmentPlan, items = itemsOf(input);
  const tasks = plan.map(task => ({
    taskId: task.id, resourceId: task.resourceId, itemIds: task.itemIds, objectiveCoverage: task.objectiveIds, scoring: task.scoring,
    attribution: task.scoring === "NOT_SCORED" ? "NOT_SCORED" as const : task.objectiveIds.length === 1 ? "ITEM" as const : "TASK_ONLY" as const,
  }));
  const primaryObjectiveGaps = plan.flatMap(task => Object.entries(statedPrimary[task.id] ?? {})
    .filter(([, objectiveId]) => !task.objectiveIds.includes(objectiveId))
    .map(([itemId, objectiveId]) => ({ taskId: task.id, itemId, statedPrimaryObjectiveId: objectiveId, taskObjectiveIds: task.objectiveIds })));
  const itemsWithoutSingleTask = items.map(item => ({ itemId: item.itemId, objectiveIds: item.objectiveIds, taskCount: plan.filter(t => t.itemIds.includes(item.itemId)).length }))
    .filter(item => item.taskCount !== 1);
  return {
    schemaVersion: "factory-assessment-attribution/1.1.0",
    rule: "ITEM_LEVEL_ONLY_FOR_SINGLE_OBJECTIVE_TASKS",
    itemObjectiveTags: "CONTRACT_COVERAGE_ONLY",
    perObjectiveMasterySupported: "SINGLE_OBJECTIVE_SCORED_TASKS_ONLY",
    canonicalMasteryMutation: false,
    authorityRequired: "Authoritative assessment contract with accurate item-to-objective attribution",
    tasks, primaryObjectiveGaps, itemsWithoutSingleTask,
    releaseBlockers: [
      ...primaryObjectiveGaps.map(g => `ASSESSMENT_PRIMARY_OBJECTIVE_NOT_IN_TASK:${g.taskId}/${g.itemId}`),
      ...itemsWithoutSingleTask.map(i => `ASSESSMENT_ITEM_NOT_IN_EXACTLY_ONE_TASK:${i.itemId}`),
    ],
  };
}
export type AssessmentAttribution = ReturnType<typeof assessmentAttribution>;

/** Resolve the objectives one item's evidence may count toward. Fails closed. */
export function attributeEvidence(attribution: AssessmentAttribution, itemId: string, options: { perObjective?: boolean } = {}) {
  const owners = attribution.tasks.filter(t => t.itemIds.includes(itemId));
  if (owners.length !== 1) throw new Error(`ITEM_NOT_IN_EXACTLY_ONE_TASK:${itemId}`);
  const task = owners[0];
  if (task.attribution === "NOT_SCORED") throw new Error(`TASK_NOT_SCORED:${task.taskId}`);
  if (attribution.primaryObjectiveGaps.some(g => g.itemId === itemId)) throw new Error(`ITEM_PRIMARY_OBJECTIVE_NOT_IN_TASK:${itemId}`);
  if (task.attribution === "ITEM") return { level: "ITEM" as const, taskId: task.taskId, objectiveIds: [...task.objectiveCoverage] };
  if (options.perObjective) throw new Error(`ITEM_LEVEL_MASTERY_PROHIBITED:${task.taskId}`);
  return { level: "TASK" as const, taskId: task.taskId, objectiveIds: null, taskObjectiveIds: [...task.objectiveCoverage] };
}
