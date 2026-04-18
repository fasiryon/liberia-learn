import type { LabAction } from "@/lib/labs/types";
import type { PeriodicProperty, PeriodicViewMode } from "@/lib/labs/periodic-table/state";

export type PeriodicTableAction =
  | { type: "SELECT_ELEMENT"; symbol: string }
  | { type: "SET_VIEW_MODE"; value: PeriodicViewMode }
  | { type: "HIGHLIGHT_CATEGORY"; category: string }
  | { type: "HIGHLIGHT_PROPERTY"; property: PeriodicProperty }
  | { type: "CLEAR_SELECTION" }
  | { type: "RESET" };

export const PERIODIC_TABLE_ACTION_TYPES = [
  "SELECT_ELEMENT",
  "SET_VIEW_MODE",
  "HIGHLIGHT_CATEGORY",
  "HIGHLIGHT_PROPERTY",
  "CLEAR_SELECTION",
  "RESET",
] as const;

export function isPeriodicTableAction(action: LabAction): action is PeriodicTableAction {
  return (PERIODIC_TABLE_ACTION_TYPES as readonly string[]).includes(action.type);
}
