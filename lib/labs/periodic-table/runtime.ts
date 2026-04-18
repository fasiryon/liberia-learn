import type { LabAction } from "@/lib/labs/types";
import { getElementBySymbol, isElementCategory } from "@/lib/labs/periodic-table/data";
import type { PeriodicTableAction } from "@/lib/labs/periodic-table/actions";
import {
  PERIODIC_TABLE_INITIAL_STATE,
  type PeriodicProperty,
  type PeriodicTableState,
  type PeriodicViewMode,
} from "@/lib/labs/periodic-table/state";

export const PERIODIC_VIEW_MODES: PeriodicViewMode[] = ["table", "bohr", "properties"];
export const PERIODIC_PROPERTIES: PeriodicProperty[] = [
  "electronegativity",
  "meltingPoint",
  "boilingPoint",
];

export function applyPeriodicTableAction(
  state: PeriodicTableState,
  action: PeriodicTableAction
): PeriodicTableState {
  switch (action.type) {
    case "SELECT_ELEMENT":
      return getElementBySymbol(action.symbol) ? { ...state, selectedElement: action.symbol } : state;
    case "SET_VIEW_MODE":
      return PERIODIC_VIEW_MODES.includes(action.value) ? { ...state, viewMode: action.value } : state;
    case "HIGHLIGHT_CATEGORY":
      return isElementCategory(action.category)
        ? { ...state, highlightCategory: action.category, highlightProperty: null }
        : state;
    case "HIGHLIGHT_PROPERTY":
      return PERIODIC_PROPERTIES.includes(action.property)
        ? { ...state, highlightProperty: action.property, viewMode: "properties" }
        : state;
    case "CLEAR_SELECTION":
      return { ...state, selectedElement: null };
    case "RESET":
      return PERIODIC_TABLE_INITIAL_STATE;
    default:
      return state;
  }
}

export function isPeriodicTableState(state: unknown): state is PeriodicTableState {
  return (
    Boolean(state) &&
    typeof state === "object" &&
    ((state as PeriodicTableState).selectedElement === null ||
      typeof (state as PeriodicTableState).selectedElement === "string") &&
    typeof (state as PeriodicTableState).viewMode === "string" &&
    typeof (state as PeriodicTableState).paused === "boolean"
  );
}

export function applyPeriodicTableLabAction(
  state: PeriodicTableState,
  action: LabAction
): PeriodicTableState {
  return applyPeriodicTableAction(state, action as PeriodicTableAction);
}
