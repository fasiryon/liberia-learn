import type { JsonObject, WorkflowRiskLevel } from "@/lib/autonomous/types";

export type DetectorScope = "student" | "teacher" | "curriculum" | "school" | "guardian" | "moe" | "national";

export type DetectorId =
  | "student-risk"
  | "teacher-support"
  | "curriculum-gap"
  | "school-compliance"
  | "guardian-communication"
  | "moe-governance"
  | "national-trend";

export type DetectorEvidenceRef = {
  type: string;
  id: string;
  source?: string;
  occurredAt?: string | Date | null;
  schoolId?: string | null;
  districtId?: string | null;
  metadata?: JsonObject;
};

export type DetectorSignal = {
  key: string;
  value: number;
  threshold: number;
  direction: "below" | "above" | "decline" | "increase" | "equals";
  weight: number;
  label: string;
  evidence: DetectorEvidenceRef[];
};

export type DetectorEvidence = {
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  targetType: string;
  targetId: string;
  windowKey: string;
  signals: DetectorSignal[];
  summary?: JsonObject;
};

export type DetectorContext = {
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  actorId?: string | null;
  targetType: string;
  targetId: string;
  triggerEventId?: string | null;
  windowKey?: string | null;
  isReplay?: boolean;
  replayOfRunId?: string | null;
};

export type DetectionFinding = {
  findingType: string;
  title: string;
  severity: "info" | "low" | "medium" | "high";
  confidence: number;
  riskLevel: WorkflowRiskLevel;
  explanation: string;
  evidence: DetectorEvidenceRef[];
  signals: DetectorSignal[];
  recommendation: {
    title: string;
    summary: string;
    suggestedActions: string[];
    suggestedInterventions?: string[];
    suggestedCurriculumImprovements?: string[];
    approvalRequired: true;
  };
};

export type DetectorDefinition = {
  id: DetectorId;
  name: string;
  ownerDomain: string;
  featureFlag: string;
  scope: DetectorScope;
  allowedTenantScopes: Array<"school" | "district" | "national_aggregate">;
  allowedEventTriggers: string[];
  requiredEvidence: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  riskCeiling: WorkflowRiskLevel;
  confidenceContract: string;
  escalationRoute: string;
  evaluationMetric: string;
  detect: (evidence: DetectorEvidence) => DetectionFinding[];
};

export type RecommendationRecordInput = {
  workflowRunId: string;
  agentRunId?: string | null;
  detectorId: DetectorId;
  traceId?: string | null;
  tenantId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  targetType: string;
  targetId: string;
  windowKey: string;
  finding: DetectionFinding;
  isReplay?: boolean;
};
