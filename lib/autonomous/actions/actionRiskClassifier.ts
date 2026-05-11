import { getActionDefinition } from "@/lib/autonomous/actions/actionRegistry";
import type { GovernedActionType } from "@/lib/autonomous/actions/types";
import type { WorkflowRiskLevel } from "@/lib/autonomous/types";

const RISK_ORDER: WorkflowRiskLevel[] = ["low", "medium", "high", "critical"];

function maxRisk(a: WorkflowRiskLevel, b: WorkflowRiskLevel): WorkflowRiskLevel {
  return RISK_ORDER[Math.max(RISK_ORDER.indexOf(a), RISK_ORDER.indexOf(b))] ?? "critical";
}

export function classifyActionRisk(input: {
  actionType: GovernedActionType;
  sourceRisk?: string | null;
  targetType?: string | null;
  aggregateScope?: boolean;
}): WorkflowRiskLevel {
  const definition = getActionDefinition(input.actionType);
  let risk = definition.defaultRisk;
  if (input.sourceRisk && RISK_ORDER.includes(input.sourceRisk as WorkflowRiskLevel)) {
    risk = maxRisk(risk, input.sourceRisk as WorkflowRiskLevel);
  }
  if (input.actionType === "guardian_communication") risk = maxRisk(risk, "high");
  if (input.actionType === "moe_governance" || input.actionType === "national_trend") risk = maxRisk(risk, "high");
  if (definition.aggregateOnly && !input.aggregateScope) risk = "critical";
  return risk;
}
