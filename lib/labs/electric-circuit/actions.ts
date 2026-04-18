export type ElectricCircuitAction =
  | { type: "SET_VOLTAGE"; value: number }
  | { type: "SET_RESISTANCE1"; value: number }
  | { type: "SET_RESISTANCE2"; value: number }
  | { type: "SET_CIRCUIT_TYPE"; value: "series" | "parallel" }
  | { type: "RESET" };

export const CIRCUIT_ACTION_TYPES = [
  "SET_VOLTAGE",
  "SET_RESISTANCE1",
  "SET_RESISTANCE2",
  "SET_CIRCUIT_TYPE",
  "RESET",
] as const;

export function isElectricCircuitAction(action: unknown): action is ElectricCircuitAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !CIRCUIT_ACTION_TYPES.includes(type as any)) return false;

  if (type === "SET_VOLTAGE" || type === "SET_RESISTANCE1" || type === "SET_RESISTANCE2") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "SET_CIRCUIT_TYPE") {
    const value = (action as { value?: unknown }).value;
    return value === "series" || value === "parallel";
  }

  return true;
}
