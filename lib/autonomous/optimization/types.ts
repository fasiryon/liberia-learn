import type { JsonObject, WorkflowRiskLevel } from "@/lib/autonomous/types";

export type OptimizationCategory =
  | "detector_threshold"
  | "evidence_weighting"
  | "confidence_calibration"
  | "intervention_timing"
  | "curriculum_review_priority"
  | "low_risk_rollout_sizing"
  | "reviewer_assignment"
  | "escalation_timing";

export type OptimizationReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";

export type OptimizationRecommendation = {
  idempotencyKey: string;
  category: OptimizationCategory;
  title: string;
  targetScope: "school" | "district" | "national" | "platform";
  targetId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  riskLevel: WorkflowRiskLevel;
  confidence: number;
  confidenceRationale: string;
  evidenceRefs: JsonObject;
  expectedImpact: string;
  rollbackGuidance: string;
  approvalRequirement: string;
  proposedChange: JsonObject;
  evaluationPlan: string;
  lineage: JsonObject;
  limitations: string[];
};

export type AutonomyReadinessScore = {
  score: number;
  detectorReliability: number;
  recommendationPrecision: number;
  rollbackEffectiveness: number;
  workflowStability: number;
  tenantSafetyConfidence: number;
  approvalGovernanceQuality: number;
  rationale: string[];
};
