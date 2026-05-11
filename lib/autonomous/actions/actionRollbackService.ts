import type { GovernedActionType } from "@/lib/autonomous/actions/types";
import type { JsonObject } from "@/lib/autonomous/types";

export function getRollbackPlan(actionType: GovernedActionType): JsonObject {
  if (actionType === "student_intervention") {
    return { rollbackPossible: true, operation: "mark_intervention_recommendation_cancelled" };
  }
  if (actionType === "curriculum_gap") {
    return { rollbackPossible: true, operation: "resolve_or_cancel_curriculum_flag" };
  }
  return {
    rollbackPossible: true,
    operation: "cancel_draft_or_alert",
    note: "No live communication, policy execution, export, or official record mutation is performed.",
  };
}
