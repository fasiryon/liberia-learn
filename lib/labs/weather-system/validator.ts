import type { LabAction, LabValidationResult } from "@/lib/labs/types";

function inRange(value: unknown, min: number, max: number) {
  return typeof value === "number" && value >= min && value <= max;
}

export function validateWeatherSystemAction(action: LabAction): LabValidationResult {
  switch (action.type) {
    case "SET_TEMPERATURE":
      return inRange(action.value, -20, 50)
        ? { ok: true }
        : { ok: false, reason: "Temperature must be between -20 and 50 C." };
    case "SET_HUMIDITY":
      return inRange(action.value, 0, 100)
        ? { ok: true }
        : { ok: false, reason: "Humidity must be between 0 and 100%." };
    case "SET_PRESSURE":
      return inRange(action.value, 950, 1050)
        ? { ok: true }
        : { ok: false, reason: "Pressure must be between 950 and 1050 hPa." };
    case "SET_WIND_SPEED":
      return inRange(action.value, 0, 150)
        ? { ok: true }
        : { ok: false, reason: "Wind speed must be between 0 and 150 km/h." };
    case "SET_SEASON":
      return action.value === "wet" || action.value === "dry"
        ? { ok: true }
        : { ok: false, reason: "Season must be wet or dry." };
    case "SIMULATE_STORM":
    case "RESET":
    case "PLAY":
    case "PAUSE":
    case "STEP":
      return { ok: true };
    default:
      return { ok: false, reason: "Unknown weather system action." };
  }
}
