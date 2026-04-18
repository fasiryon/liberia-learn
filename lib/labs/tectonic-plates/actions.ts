import type { LabAction } from "@/lib/labs/types";
import type { BoundaryType } from "@/lib/labs/tectonic-plates/state";

export type TectonicPlatesAction =
  | { type: "SET_PLATE1_SPEED"; value: number }
  | { type: "SET_PLATE2_SPEED"; value: number }
  | { type: "SET_BOUNDARY_TYPE"; value: BoundaryType }
  | { type: "TRIGGER_EARTHQUAKE" }
  | { type: "TRIGGER_ERUPTION" }
  | { type: "RESET" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STEP" };

export const TECTONIC_ACTION_TYPES = [
  "SET_PLATE1_SPEED",
  "SET_PLATE2_SPEED",
  "SET_BOUNDARY_TYPE",
  "TRIGGER_EARTHQUAKE",
  "TRIGGER_ERUPTION",
  "RESET",
  "PLAY",
  "PAUSE",
  "STEP",
] as const;

export function isTectonicPlatesAction(action: LabAction): action is TectonicPlatesAction {
  return (TECTONIC_ACTION_TYPES as readonly string[]).includes(action.type);
}
