import type { EcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validateEcosystemBalanceAction(action: EcosystemBalanceAction): LabValidationResult {
  switch (action.type) {
    case "SET_PLANTS":
      return action.value >= 0 && action.value <= 1000
        ? { ok: true }
        : { ok: false, reason: "Plant count must be between 0 and 1000." };
    case "SET_HERBIVORES":
      return action.value >= 0 && action.value <= 500
        ? { ok: true }
        : { ok: false, reason: "Herbivore count must be between 0 and 500." };
    case "SET_CARNIVORES":
      return action.value >= 0 && action.value <= 200
        ? { ok: true }
        : { ok: false, reason: "Carnivore count must be between 0 and 200." };
    case "ADD_DROUGHT":
    case "REMOVE_DROUGHT":
    case "RESET":
    case "PLAY":
    case "PAUSE":
    case "STEP":
      return { ok: true };
  }
}
