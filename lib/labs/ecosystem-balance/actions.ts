export type EcosystemBalanceAction =
  | { type: "SET_PLANTS"; value: number }
  | { type: "SET_HERBIVORES"; value: number }
  | { type: "SET_CARNIVORES"; value: number }
  | { type: "ADD_DROUGHT" }
  | { type: "REMOVE_DROUGHT" }
  | { type: "RESET" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STEP" };

export const ECOSYSTEM_ACTION_TYPES = [
  "SET_PLANTS",
  "SET_HERBIVORES",
  "SET_CARNIVORES",
  "ADD_DROUGHT",
  "REMOVE_DROUGHT",
  "RESET",
  "PLAY",
  "PAUSE",
  "STEP",
] as const;

export function isEcosystemBalanceAction(action: unknown): action is EcosystemBalanceAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !ECOSYSTEM_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_PLANTS" || type === "SET_HERBIVORES" || type === "SET_CARNIVORES") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  return true;
}
