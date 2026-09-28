// Measures a registered lab across all of its review-scenario states. Shared by the CI budget test and the
// baseline script so both measure exactly the same thing.
import { getInteractiveLabDefinition } from "../registry";
import { getLabReviewScenarioSet } from "../review/referenceScenarios";
import { replayReviewScenario } from "../review/scenarios";
import { initializeLab } from "../kernel";
import type { LabState } from "../types";
import { measureLabBudget, type LabAssetBytes, type LabBudgetMeasurement } from "./budgets";

export function measureRegisteredLab(labId: string, assets: LabAssetBytes[] = []): LabBudgetMeasurement {
  const definition = getInteractiveLabDefinition(labId);
  const set = getLabReviewScenarioSet(labId);
  if (!definition || !set) throw new Error(`${labId} has no definition or review scenario set.`);
  const states: LabState[] = [initializeLab(definition)];
  for (const scenario of set.scenarios) {
    const replay = replayReviewScenario(definition, scenario);
    if ("reason" in replay) throw new Error(`${labId}/${scenario.id}: ${replay.reason}`);
    states.push(replay.state);
  }
  return measureLabBudget(definition, states, assets);
}
