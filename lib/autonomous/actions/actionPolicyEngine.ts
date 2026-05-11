import { getActionDefinition } from "@/lib/autonomous/actions/actionRegistry";
import { classifyActionRisk } from "@/lib/autonomous/actions/actionRiskClassifier";
import { isLowRiskAutonomyEnabled } from "@/lib/serverFlags";
import type { ActionPolicy, GovernedActionType } from "@/lib/autonomous/actions/types";

export function isMoeAggregateSafe(input: {
  actionType: GovernedActionType;
  targetType?: string | null;
  schoolId?: string | null;
  decision?: any | null;
}) {
  if (input.actionType !== "moe_governance" && input.actionType !== "national_trend") return true;
  if (input.schoolId) return false;
  if (input.targetType !== "district" && input.targetType !== "national_aggregate") return false;
  const payload = input.decision?.decision ?? input.decision ?? {};
  return !["student", "guardian", "user"].includes(String(payload.targetType ?? "").toLowerCase());
}

export function evaluateActionPolicy(input: {
  actionType: GovernedActionType;
  sourceRisk?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  decision?: any | null;
}): ActionPolicy {
  const definition = getActionDefinition(input.actionType);
  const aggregateSafe = isMoeAggregateSafe(input);
  let riskLevel = classifyActionRisk({
    actionType: input.actionType,
    sourceRisk: input.sourceRisk,
    targetType: input.targetType,
    aggregateScope: input.targetType === "district" || input.targetType === "national_aggregate",
  });
  const lowRiskPilotEligible =
    isLowRiskAutonomyEnabled() &&
    input.sourceRisk === "low" &&
    !!input.schoolId &&
    ((input.actionType === "teacher_support" && ["teacher", "class", "school"].includes(String(input.targetType))) ||
      (input.actionType === "curriculum_gap" && ["curriculum", "lesson", "unit"].includes(String(input.targetType))) ||
      (input.actionType === "school_compliance" && input.targetType === "school"));
  if (lowRiskPilotEligible) riskLevel = "low";

  const draftOnly = (definition.draftOnly && riskLevel !== "low") || input.actionType === "guardian_communication";
  const approvalRequired = riskLevel !== "low" || draftOnly;
  let requiredApproverRole: ActionPolicy["requiredApproverRole"] = "ADMIN";
  if (input.actionType === "student_intervention" || input.actionType === "guardian_communication") {
    requiredApproverRole = riskLevel === "high" ? "ADMIN" : "TEACHER";
  } else if (input.actionType === "moe_governance" || input.actionType === "national_trend") {
    requiredApproverRole = "MOE_OFFICIAL";
  } else if (riskLevel === "high") {
    requiredApproverRole = "PLATFORM_ADMIN";
  }

  return {
    actionType: input.actionType,
    riskLevel,
    requiredApproverRole,
    approvalRequired,
    executionAllowed: riskLevel !== "critical" && aggregateSafe,
    draftOnly,
    aggregateSafe,
    reason: aggregateSafe
      ? "Policy permits preparation with approval gates."
      : "Policy blocked execution because aggregate safety or tenant scope failed.",
  };
}
