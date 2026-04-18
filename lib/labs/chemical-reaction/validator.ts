import type { LabAction, LabValidationResult } from "@/lib/labs/types";

function inRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && value >= min && value <= max;
}

export function validateChemicalReactionAction(action: LabAction): LabValidationResult {
  switch (action.type) {
    case "SET_REACTANT_A":
      return inRange(action.value, 0, 100)
        ? { ok: true }
        : { ok: false, reason: "Reactant A must be between 0 and 100 mol." };
    case "SET_REACTANT_B":
      return inRange(action.value, 0, 100)
        ? { ok: true }
        : { ok: false, reason: "Reactant B must be between 0 and 100 mol." };
    case "SET_TEMPERATURE":
      return inRange(action.value, 0, 500)
        ? { ok: true }
        : { ok: false, reason: "Temperature must be between 0 and 500 C." };
    case "SET_ENERGY_TYPE":
      return action.value === "exothermic" || action.value === "endothermic"
        ? { ok: true }
        : { ok: false, reason: "Energy type must be exothermic or endothermic." };
    case "ADD_CATALYST":
    case "REMOVE_CATALYST":
    case "START_REACTION":
    case "RESET":
    case "STEP":
      return { ok: true };
    default:
      return { ok: false, reason: "Unknown chemical reaction action." };
  }
}
