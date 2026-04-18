import type { LabAction } from "@/lib/labs/types";

export type ChemicalReactionAction =
  | { type: "SET_REACTANT_A"; value: number }
  | { type: "SET_REACTANT_B"; value: number }
  | { type: "SET_TEMPERATURE"; value: number }
  | { type: "ADD_CATALYST" }
  | { type: "REMOVE_CATALYST" }
  | { type: "SET_ENERGY_TYPE"; value: "exothermic" | "endothermic" }
  | { type: "START_REACTION" }
  | { type: "RESET" }
  | { type: "STEP" };

export const REACTION_ACTION_TYPES = [
  "SET_REACTANT_A",
  "SET_REACTANT_B",
  "SET_TEMPERATURE",
  "ADD_CATALYST",
  "REMOVE_CATALYST",
  "SET_ENERGY_TYPE",
  "START_REACTION",
  "RESET",
  "STEP",
] as const;

export function isChemicalReactionAction(action: LabAction): action is ChemicalReactionAction {
  return (REACTION_ACTION_TYPES as readonly string[]).includes(action.type);
}
