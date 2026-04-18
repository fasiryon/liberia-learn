import type { PendulumLabAction } from "@/lib/labs/pendulum-lab/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validatePendulumLabAction(action: PendulumLabAction): LabValidationResult {
  switch (action.type) {
    case "SET_LENGTH":
      return action.value >= 0.1 && action.value <= 5
        ? { ok: true }
        : { ok: false, reason: "Length must be between 0.1 m and 5 m." };
    case "SET_ANGLE":
      return action.value >= -90 && action.value <= 90
        ? { ok: true }
        : { ok: false, reason: "Angle must be between -90 and 90 degrees." };
    case "SET_DAMPING":
      return action.value >= 0 && action.value <= 1
        ? { ok: true }
        : { ok: false, reason: "Damping must be between 0 and 1." };
    case "PLAY":
    case "PAUSE":
    case "RESET":
    case "STEP":
      return { ok: true };
  }
}
