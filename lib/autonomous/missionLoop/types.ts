// lib/autonomous/missionLoop/types.ts
export type PhaseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED";

export type MissionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "FAILED";

export type ChecklistItemStatus = "PENDING" | "DONE" | "SKIPPED" | "BLOCKED";

export type AcceptanceCriterion =
  | { type: "command"; label: string; command: string }
  | { type: "approval_resolved"; approvalRequestId: string }
  | { type: "review_task_resolved"; qualityReviewTaskId: string };

export type CriterionResult = {
  criterion: AcceptanceCriterion;
  passed: boolean;
  detail: string;
};

export type ChecklistItemInput = {
  label: string;
  required?: boolean;
};

export type PhaseInput = {
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  dependsOnPhaseIds?: string[];
  checklist: ChecklistItemInput[];
};

export type ChecklistItemDetail = {
  id: string;
  label: string;
  required: boolean;
  status: ChecklistItemStatus;
  evidenceRef: unknown;
  completedAt: Date | null;
};

export type PhaseDetail = {
  id: string;
  workflowRunId: string;
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  status: PhaseStatus;
  dependsOnPhaseIds: string[];
  attempt: number;
  lastProgressAt: Date | null;
  blockedReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  checklist: ChecklistItemDetail[];
};

export type MissionDetail = {
  id: string;
  objective: string;
  scope: unknown;
  constraints: unknown;
  acceptanceCriteria: AcceptanceCriterion[];
  dependsOnRunIds: string[];
  status: MissionStatus;
  phases: PhaseDetail[];
};
