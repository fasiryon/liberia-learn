import type { LabAction, LabValidationResult } from "@/lib/labs/types";

function inRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && value >= min && value <= max;
}

export function validateTectonicPlatesAction(action: LabAction): LabValidationResult {
  switch (action.type) {
    case "SET_PLATE1_SPEED":
      return inRange(action.value, 0, 10)
        ? { ok: true }
        : { ok: false, reason: "Plate 1 speed must be between 0 and 10 cm/yr." };
    case "SET_PLATE2_SPEED":
      return inRange(action.value, 0, 10)
        ? { ok: true }
        : { ok: false, reason: "Plate 2 speed must be between 0 and 10 cm/yr." };
    case "SET_BOUNDARY_TYPE":
      return action.value === "convergent" || action.value === "divergent" || action.value === "transform"
        ? { ok: true }
        : { ok: false, reason: "Boundary type must be convergent, divergent, or transform." };
    case "TRIGGER_EARTHQUAKE":
    case "TRIGGER_ERUPTION":
    case "RESET":
    case "PLAY":
    case "PAUSE":
    case "STEP":
      return { ok: true };
    default:
      return { ok: false, reason: "Unknown tectonic plates action." };
  }
}
