import type { ActionDefinition, GovernedActionType } from "@/lib/autonomous/actions/types";

export const actionRegistry: Record<GovernedActionType, ActionDefinition> = {
  student_intervention: {
    actionType: "student_intervention",
    label: "Student Intervention Action",
    sourceDecisionTypes: ["detector.recommendation.student-risk"],
    defaultRisk: "medium",
    supportedTargetTypes: ["student"],
    draftOnly: false,
    aggregateOnly: false,
    forbiddenEffects: ["grade.change", "official_record.change"],
  },
  teacher_support: {
    actionType: "teacher_support",
    label: "Teacher Support Action",
    sourceDecisionTypes: ["detector.recommendation.teacher-support"],
    defaultRisk: "medium",
    supportedTargetTypes: ["teacher", "class", "school"],
    draftOnly: true,
    aggregateOnly: false,
    forbiddenEffects: ["assignment.reassign"],
  },
  curriculum_gap: {
    actionType: "curriculum_gap",
    label: "Curriculum Gap Action",
    sourceDecisionTypes: ["detector.recommendation.curriculum-gap"],
    defaultRisk: "medium",
    supportedTargetTypes: ["curriculum", "lesson", "unit", "student"],
    draftOnly: false,
    aggregateOnly: false,
    forbiddenEffects: ["curriculum.publish"],
  },
  guardian_communication: {
    actionType: "guardian_communication",
    label: "Guardian Communication Action",
    sourceDecisionTypes: ["detector.recommendation.guardian-communication"],
    defaultRisk: "high",
    supportedTargetTypes: ["student", "guardian"],
    draftOnly: true,
    aggregateOnly: false,
    forbiddenEffects: ["sms.send", "email.send", "message.export"],
  },
  school_compliance: {
    actionType: "school_compliance",
    label: "School Compliance Action",
    sourceDecisionTypes: ["detector.recommendation.school-compliance"],
    defaultRisk: "medium",
    supportedTargetTypes: ["school"],
    draftOnly: true,
    aggregateOnly: false,
    forbiddenEffects: ["school_status.change"],
  },
  moe_governance: {
    actionType: "moe_governance",
    label: "MOE Governance Action",
    sourceDecisionTypes: ["detector.recommendation.moe-governance"],
    defaultRisk: "high",
    supportedTargetTypes: ["district", "national_aggregate"],
    draftOnly: true,
    aggregateOnly: true,
    forbiddenEffects: ["policy.execute", "raw_pii.export"],
  },
  national_trend: {
    actionType: "national_trend",
    label: "National Trend Action",
    sourceDecisionTypes: ["detector.recommendation.national-trend"],
    defaultRisk: "high",
    supportedTargetTypes: ["national_aggregate"],
    draftOnly: true,
    aggregateOnly: true,
    forbiddenEffects: ["policy.execute", "raw_pii.export"],
  },
};

export function listActions() {
  return Object.values(actionRegistry);
}

export function getActionDefinition(actionType: GovernedActionType) {
  return actionRegistry[actionType];
}

export function inferActionTypeFromDecision(decisionType: string): GovernedActionType {
  const match = listActions().find((definition) => definition.sourceDecisionTypes.includes(decisionType));
  if (!match) {
    throw Object.assign(new Error("Unsupported recommendation decision type"), {
      code: "unsupported_recommendation_action",
      status: 400,
    });
  }
  return match.actionType;
}
