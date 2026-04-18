export type WaveMotionAction =
  | { type: "SET_FREQUENCY"; value: number }
  | { type: "SET_AMPLITUDE"; value: number }
  | { type: "SET_WAVE_SPEED"; value: number }
  | { type: "SET_WAVE_TYPE"; value: "transverse" | "longitudinal" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP"; dt?: number };

export const WAVE_ACTION_TYPES = [
  "SET_FREQUENCY",
  "SET_AMPLITUDE",
  "SET_WAVE_SPEED",
  "SET_WAVE_TYPE",
  "PLAY",
  "PAUSE",
  "RESET",
  "STEP",
] as const;

export function isWaveMotionAction(action: unknown): action is WaveMotionAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !WAVE_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_FREQUENCY" || type === "SET_AMPLITUDE" || type === "SET_WAVE_SPEED") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "SET_WAVE_TYPE") {
    const value = (action as { value?: unknown }).value;
    return value === "transverse" || value === "longitudinal";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
