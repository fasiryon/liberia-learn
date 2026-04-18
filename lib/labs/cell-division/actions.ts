export type CellDivisionAction =
  | { type: "ADVANCE_STAGE" }
  | { type: "SET_SPEED"; value: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP"; dt?: number };

export const CELL_DIVISION_ACTION_TYPES = [
  "ADVANCE_STAGE",
  "SET_SPEED",
  "PLAY",
  "PAUSE",
  "RESET",
  "STEP",
] as const;

export function isCellDivisionAction(action: unknown): action is CellDivisionAction {
  if (!action || typeof action !== "object") return false;
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !CELL_DIVISION_ACTION_TYPES.includes(type as any)) {
    return false;
  }

  if (type === "SET_SPEED") {
    return typeof (action as { value?: unknown }).value === "number";
  }

  if (type === "STEP") {
    const dt = (action as { dt?: unknown }).dt;
    return dt === undefined || typeof dt === "number";
  }

  return true;
}
