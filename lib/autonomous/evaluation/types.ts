import type { JsonObject, WorkflowRiskLevel } from "@/lib/autonomous/types";

export type EvaluationOutcome =
  | "accepted"
  | "rejected"
  | "executed"
  | "no_action"
  | "false_positive"
  | "false_negative"
  | "improved"
  | "no_measurable_change";

export type RecommendationEvaluation = {
  agentDecisionId: string;
  workflowRunId: string;
  detectorId?: string | null;
  decisionType: string;
  outcome: EvaluationOutcome;
  confidenceBefore: number;
  confidenceAfter: number;
  precisionScore: number;
  evidenceCoverageScore: number;
  effectivenessScore: number;
  riskLevel: WorkflowRiskLevel;
  evaluationVersion: string;
  lineage: JsonObject;
  explanation: string;
};

