export type GravityLabAction =
  | { type: "SET_GRAVITY"; value: number }
  | { type: "SET_MASS"; value: number }
  | { type: "SET_HEIGHT"; value: number }
  | { type: "RESET" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STEP"; dt?: number };

export const GRAVITY_ACTION_TYPES = [
  "SET_GRAVITY",
  "SET_MASS",
  "SET_HEIGHT",
  "RESET",
  "PLAY",
  "PAUSE",
  "STEP",
] as const;

export function isGravityLabAction(action: unknown): action is GravityLabAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !GRAVITY_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_GRAVITY" || type === "SET_MASS" || type === "SET_HEIGHT") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
