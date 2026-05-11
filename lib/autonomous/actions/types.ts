import type { SessionUser } from "@/lib/auth";
import type { JsonObject, WorkflowRiskLevel } from "@/lib/autonomous/types";

export type GovernedActionType =
  | "student_intervention"
  | "teacher_support"
  | "curriculum_gap"
  | "guardian_communication"
  | "school_compliance"
  | "moe_governance"
  | "national_trend";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
export type GovernedActionStatus =
  | "PREPARED"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "EXECUTED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED";

export type ActionPolicy = {
  actionType: GovernedActionType;
  riskLevel: WorkflowRiskLevel;
  requiredApproverRole: "TEACHER" | "ADMIN" | "PLATFORM_ADMIN" | "MOE_OFFICIAL" | "GOVERNANCE";
  approvalRequired: boolean;
  executionAllowed: boolean;
  draftOnly: boolean;
  aggregateSafe: boolean;
  reason: string;
};

export type ActionDefinition = {
  actionType: GovernedActionType;
  label: string;
  sourceDecisionTypes: string[];
  defaultRisk: WorkflowRiskLevel;
  supportedTargetTypes: string[];
  draftOnly: boolean;
  aggregateOnly: boolean;
  forbiddenEffects: string[];
};

export type PrepareActionInput = {
  agentDecisionId: string;
  requestedBy: SessionUser;
  actionType?: GovernedActionType | null;
  expiresAt?: Date | null;
};

export type ApprovalDecisionInput = {
  approvalRequestId: string;
  decidedBy: SessionUser;
  comment?: string | null;
};

export type ActionExecutionContext = {
  actionExecution: any;
  approvalRequest?: any | null;
  actor?: SessionUser | null;
  policy: ActionPolicy;
  decision?: any | null;
  workflowRun?: any | null;
};

export type ActionResult = {
  status: GovernedActionStatus;
  outputRefs?: JsonObject;
  message?: string;
};

export type ExecutionGuardResult = {
  allowed: boolean;
  reason: string;
  degradedMode?: boolean;
  metrics?: JsonObject;
};

export type WorkerHealthStatus = "healthy" | "degraded" | "saturated" | "shutdown";

export type ApprovalSLAStatus = "within_sla" | "warning" | "breached" | "expired";
