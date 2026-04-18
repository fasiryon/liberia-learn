export type MoleculeMotionAction =
  | { type: "SET_TEMPERATURE"; value: number }
  | { type: "SET_PARTICLE_COUNT"; value: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP"; dt?: number };

export const MOLECULE_ACTION_TYPES = [
  "SET_TEMPERATURE",
  "SET_PARTICLE_COUNT",
  "PLAY",
  "PAUSE",
  "RESET",
  "STEP",
] as const;

export function isMoleculeMotionAction(action: unknown): action is MoleculeMotionAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !MOLECULE_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_TEMPERATURE" || type === "SET_PARTICLE_COUNT") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
