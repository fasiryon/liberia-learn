export type RuntimeHealthStatus = "healthy" | "degraded" | "saturated" | "shutdown" | "unknown";

export type RuntimeHealthSummary = {
  status: RuntimeHealthStatus;
  timestamp: string;
  queueConfigured: boolean;
  dbReachable: boolean;
  activeExecutions: number;
  stuckWorkflows: number;
  deadLetterCount: number;
  recentFailureRate: number | null;
  backpressureActive: boolean;
  emergencyShutdown: boolean;
  degradedMode: boolean;
  signals: string[];
};

export type WorkflowRecoveryResult = {
  scanned: number;
  recovered: number;
  quarantined: number;
  skipped: number;
  details: Array<{
    workflowRunId: string;
    action: "recovered" | "quarantined" | "skipped";
    reason: string;
  }>;
};

export type DeadLetterItem = {
  workflowRunId: string;
  workflowType: string;
  schoolId: string | null;
  deadLetteredAt: string | null;
  attempt: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  replayEligible: boolean;
  quarantined: boolean;
};

export type DeadLetterSummary = {
  total: number;
  replayEligible: number;
  quarantined: number;
  items: DeadLetterItem[];
};

export type RuntimeMetricsSummary = {
  timestamp: string;
  range: { from: string; to: string };
  workflows: {
    total: number;
    pending: number;
    running: number;
    succeeded: number;
    failed: number;
    deadLettered: number;
    stuckCount: number;
  };
  retryBudget: {
    used: number;
    limit: number;
    exhausted: boolean;
  };
  approvals: {
    pending: number;
    overdue: number;
  };
  evaluationWindows: {
    open: number;
    due: number;
  };
};

export type BackpressureResult = {
  active: boolean;
  reason: string | null;
  pendingWorkflows: number;
  pendingThreshold: number;
};

export type AutonomousCronPipeline =
  | "autonomous.stale_approvals"
  | "autonomous.evaluation_windows"
  | "autonomous.workflow_recovery"
  | "autonomous.runtime_health"
  | "autonomous.dead_letter_inspection";

export type CronRunStatus = "ok" | "skipped" | "error";

export type AutonomousCronRunRecord = {
  pipeline: AutonomousCronPipeline;
  ranAt: string;
  durationMs: number;
  processed: number;
  failed: number;
  status: CronRunStatus;
  error?: string | null;
};
