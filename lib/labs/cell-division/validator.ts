import type { CellDivisionAction } from "@/lib/labs/cell-division/actions";
import type { LabValidationResult } from "@/lib/labs/types";

export function validateCellDivisionAction(action: CellDivisionAction): LabValidationResult {
  switch (action.type) {
    case "SET_SPEED":
      return action.value >= 1 && action.value <= 5
        ? { ok: true }
        : { ok: false, reason: "Speed must be between 1 and 5." };
    case "ADVANCE_STAGE":
    case "PLAY":
    case "PAUSE":
    case "RESET":
    case "STEP":
      return { ok: true };
  }
}
