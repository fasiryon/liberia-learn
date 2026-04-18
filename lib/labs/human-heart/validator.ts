import type { HumanHeartAction } from "@/lib/labs/human-heart/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validateHumanHeartAction(action: HumanHeartAction): LabValidationResult {
  switch (action.type) {
    case "SET_HEART_RATE":
      return action.value >= 20 && action.value <= 200
        ? { ok: true }
        : { ok: false, reason: "Heart rate must be between 20 and 200 bpm." };
    case "SET_EXERCISE_LEVEL":
      return action.value >= 0 && action.value <= 3
        ? { ok: true }
        : { ok: false, reason: "Exercise level must be between 0 and 3." };
    case "SIMULATE_BLOCKAGE":
    case "CLEAR_BLOCKAGE":
    case "PLAY":
    case "PAUSE":
    case "RESET":
    case "STEP":
      return { ok: true };
  }
}
