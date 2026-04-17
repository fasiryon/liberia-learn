import type { GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import type { LabValidationResult } from "@/lib/labs/types";

function inRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateGravityLabAction(action: GravityLabAction): LabValidationResult {
  switch (action.type) {
    case "SET_GRAVITY":
      return inRange(action.value, 0, 30)
        ? { ok: true }
        : { ok: false, reason: "Gravity must be between 0 and 30 m/s^2." };
    case "SET_MASS":
      return inRange(action.value, 0.1, 100)
        ? { ok: true }
        : { ok: false, reason: "Mass must be between 0.1 and 100 kg." };
    case "SET_HEIGHT":
      return inRange(action.value, 0, 100)
        ? { ok: true }
        : { ok: false, reason: "Height must be between 0 and 100 m." };
    case "STEP":
    case "PLAY":
    case "PAUSE":
    case "RESET":
      return { ok: true };
  }
}
