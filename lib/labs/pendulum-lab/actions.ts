export type PendulumLabAction =
  | { type: "SET_LENGTH"; value: number }
  | { type: "SET_ANGLE"; value: number }
  | { type: "SET_DAMPING"; value: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP"; dt?: number };

export const PENDULUM_ACTION_TYPES = [
  "SET_LENGTH",
  "SET_ANGLE",
  "SET_DAMPING",
  "PLAY",
  "PAUSE",
  "RESET",
  "STEP",
] as const;

export function isPendulumLabAction(action: unknown): action is PendulumLabAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !PENDULUM_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_LENGTH" || type === "SET_ANGLE" || type === "SET_DAMPING") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
