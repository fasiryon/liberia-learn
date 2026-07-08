export type GoalStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PAUSED_FOR_HUMAN"
  | "PAUSED_FOR_SCHEDULE"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface GoalRecord {
  id: string;
  agentName: string;
  initiatedBy: string;
  goalDescription: string;
  status: GoalStatus;
  state: Record<string, unknown>;
  pauseReason: string | null;
  pauseUntil: Date | null;
  humanReviewRequired: boolean;
  stepCount: number;
  lastError: string | null;
}

/** What a goal handler decides to do on a single step. */
export type GoalStepResult =
  | { kind: "continue"; state?: Record<string, unknown> }
  | { kind: "pause_human"; reason: string; state?: Record<string, unknown> }
  | { kind: "pause_schedule"; until: Date; reason?: string; state?: Record<string, unknown> }
  | { kind: "complete"; state?: Record<string, unknown> }
  | { kind: "fail"; reason: string; state?: Record<string, unknown> };

export interface GoalStepContext {
  goal: GoalRecord;
  /** Present only on the first step after a human resume. */
  resumeInput?: Record<string, unknown> | null;
}

/** Agent-specific stepping logic; may call runAgent internally. */
export type GoalHandler = (ctx: GoalStepContext) => Promise<GoalStepResult>;

export interface AdvanceResult {
  advanced: boolean;
  status: GoalStatus;
  reason?: string;
}
