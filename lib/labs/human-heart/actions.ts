export type HumanHeartAction =
  | { type: "SET_HEART_RATE"; value: number }
  | { type: "SET_EXERCISE_LEVEL"; value: number }
  | { type: "SIMULATE_BLOCKAGE" }
  | { type: "CLEAR_BLOCKAGE" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP"; dt?: number };

export const HEART_ACTION_TYPES = [
  "SET_HEART_RATE",
  "SET_EXERCISE_LEVEL",
  "SIMULATE_BLOCKAGE",
  "CLEAR_BLOCKAGE",
  "PLAY",
  "PAUSE",
  "RESET",
  "STEP",
] as const;

export function isHumanHeartAction(action: unknown): action is HumanHeartAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !HEART_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_HEART_RATE" || type === "SET_EXERCISE_LEVEL") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
