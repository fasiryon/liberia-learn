import type { MoleculeMotionAction } from "@/lib/labs/molecule-motion/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validateMoleculeMotionAction(action: MoleculeMotionAction): LabValidationResult {
  switch (action.type) {
    case "SET_TEMPERATURE":
      return action.value >= 0 && action.value <= 1000
        ? { ok: true }
        : { ok: false, reason: "Temperature must be between 0 K and 1000 K." };
    case "SET_PARTICLE_COUNT":
      return action.value >= 10 && action.value <= 200
        ? { ok: true }
        : { ok: false, reason: "Particle count must be between 10 and 200." };
    case "PLAY":
    case "PAUSE":
    case "RESET":
    case "STEP":
      return { ok: true };
  }
}
