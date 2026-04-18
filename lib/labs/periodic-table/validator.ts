import { ELEMENT_CATEGORIES, getElementBySymbol } from "@/lib/labs/periodic-table/data";
import { PERIODIC_PROPERTIES, PERIODIC_VIEW_MODES } from "@/lib/labs/periodic-table/runtime";
import type { LabAction, LabValidationResult } from "@/lib/labs/types";

export function validatePeriodicTableAction(action: LabAction): LabValidationResult {
  switch (action.type) {
    case "SELECT_ELEMENT":
      return typeof action.symbol === "string" && getElementBySymbol(action.symbol)
        ? { ok: true }
        : { ok: false, reason: "Element symbol must exist in the periodic table." };
    case "SET_VIEW_MODE":
      return typeof action.value === "string" && PERIODIC_VIEW_MODES.includes(action.value as any)
        ? { ok: true }
        : { ok: false, reason: "View mode must be table, bohr, or properties." };
    case "HIGHLIGHT_CATEGORY":
      return typeof action.category === "string" &&
        (ELEMENT_CATEGORIES as readonly string[]).includes(action.category)
        ? { ok: true }
        : { ok: false, reason: "Category is not valid for the periodic table." };
    case "HIGHLIGHT_PROPERTY":
      return typeof action.property === "string" && PERIODIC_PROPERTIES.includes(action.property as any)
        ? { ok: true }
        : { ok: false, reason: "Property must be electronegativity, meltingPoint, or boilingPoint." };
    case "CLEAR_SELECTION":
    case "RESET":
      return { ok: true };
    default:
      return { ok: false, reason: "Unknown periodic table action." };
  }
}
