import type { LabValidationResult } from "@/lib/labs/types";
import type { WaveMotionAction } from "@/lib/labs/wave-motion/actions";

export function validateWaveMotionAction(action: WaveMotionAction): LabValidationResult {
  switch (action.type) {
    case "SET_FREQUENCY":
      return action.value >= 0.1 && action.value <= 10
        ? { ok: true }
        : { ok: false, reason: "Frequency must be between 0.1 Hz and 10 Hz." };
    case "SET_AMPLITUDE":
      return action.value >= 0.1 && action.value <= 5
        ? { ok: true }
        : { ok: false, reason: "Amplitude must be between 0.1 m and 5 m." };
    case "SET_WAVE_SPEED":
      return action.value >= 1 && action.value <= 20
        ? { ok: true }
        : { ok: false, reason: "Wave speed must be between 1 m/s and 20 m/s." };
    case "SET_WAVE_TYPE":
      return action.value === "transverse" || action.value === "longitudinal"
        ? { ok: true }
        : { ok: false, reason: "Wave type must be transverse or longitudinal." };
    case "PLAY":
    case "PAUSE":
    case "RESET":
    case "STEP":
      return { ok: true };
  }
}
