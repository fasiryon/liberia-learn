import type { ElectricCircuitAction } from "@/lib/labs/electric-circuit/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validateElectricCircuitAction(action: ElectricCircuitAction): LabValidationResult {
  switch (action.type) {
    case "SET_VOLTAGE":
      return action.value >= 0 && action.value <= 24
        ? { ok: true }
        : { ok: false, reason: "Voltage must be between 0 V and 24 V." };
    case "SET_RESISTANCE1":
      return action.value >= 1 && action.value <= 1000
        ? { ok: true }
        : { ok: false, reason: "Resistance 1 must be between 1 ohm and 1000 ohms." };
    case "SET_RESISTANCE2":
      return action.value >= 1 && action.value <= 1000
        ? { ok: true }
        : { ok: false, reason: "Resistance 2 must be between 1 ohm and 1000 ohms." };
    case "SET_CIRCUIT_TYPE":
      return action.value === "series" || action.value === "parallel"
        ? { ok: true }
        : { ok: false, reason: "Circuit type must be series or parallel." };
    case "RESET":
      return { ok: true };
  }
}
