export type WorkflowStatus =
  | "pending"
  | "eligible"
  | "running"
  | "waiting_for_approval"
  | "approved"
  | "executing"
  | "succeeded"
  | "failed"
  | "dead_lettered"
  | "cancelled"
  | "replayed";

export type WorkflowRiskLevel = "low" | "medium" | "high" | "critical";

export type WorkflowReplayMode = "analysis_only" | "recommendation_only" | "approved_action_replay";

export type JsonObject = Record<string, unknown>;

export const ACTIVE_WORKFLOW_STATUSES: WorkflowStatus[] = [
  "pending",
  "eligible",
  "running",
  "waiting_for_approval",
  "approved",
  "executing",
];

export const TERMINAL_WORKFLOW_STATUSES: WorkflowStatus[] = [
  "succeeded",
  "failed",
  "dead_lettered",
  "cancelled",
  "replayed",
];

export function isApprovalStatus(status: WorkflowStatus) {
  return status === "waiting_for_approval" || status === "approved";
}

