import type { z } from "zod";

/**
 * Sprint 6.0a — Agent Platform Foundation: shared types.
 *
 * Agents and tools are declared in CODE (this registry lives in the repo, not
 * the database) — adding one requires a commit and review, by design.
 */

/** Roles that may trigger an agent or tool. */
export type AgentRole =
  | "student"
  | "teacher"
  | "principal"
  | "guardian"
  | "moe"
  | "admin"
  /** Trusted infrastructure caller (e.g. an SMS webhook), not a human role. */
  | "system";

/** Domain a tool belongs to (for grouping / governance). */
export type ToolDomain =
  | "student"
  | "teacher"
  | "guardian"
  | "moe"
  | "admin"
  | "system";

/** What caused an invocation to run. */
export type TriggeredBy = "USER" | "SCHEDULE" | "EVENT" | "GOAL_CONTINUATION";

/** Terminal status of a single agent invocation. */
export type InvocationStatus =
  | "SUCCESS"
  | "FAILURE"
  | "ESCALATED"
  | "TIMEOUT"
  | "COST_CAPPED"
  | "FEATURE_DISABLED";

export interface AgentCostLimits {
  /** Hard cap on LLM spend for a single invocation. */
  perInvocationUSD: number;
  /** Rolling daily cap per user (enforced in 6.0b). */
  perUserPerDayUSD: number;
  /** Rolling daily cap across all users (enforced in 6.0b). */
  perDayTotalUSD: number;
}

export interface AgentDefinition {
  /** Unique identifier. */
  name: string;
  description: string;
  /** promptRegistry key; the template is loaded from a file at module load. */
  systemPromptKey: string;
  /** Names of tools this agent is allowed to call. */
  toolAllowlist: string[];
  /** Optional OpenAI model override passed to routedCompletion. */
  llmModel?: string;
  temperature?: number;
  maxTokens: number;
  costLimits: AgentCostLimits;
  /** Kill-switch env key checked before every invocation. */
  featureFlag: string;
  rolesAllowed: AgentRole[];
  version: string;
}

/** Context handed to a tool handler at execution time. */
export interface ToolContext {
  userId?: string | null;
  userRole?: AgentRole | null;
  schoolId?: string | null;
  traceId?: string | null;
  agentName: string;
  /**
   * Student IDs the caller has been granted temporary, per-conversation
   * access to via the Student-ID + name identity challenge (Sprint 6.1,
   * docs/agents/GUARDIAN_IDENTITY_VERIFICATION.md option (a)) - distinct
   * from userId, which is only ever set for a resolved, permanent
   * guardian identity (the known-number path).
   */
  grantedStudentIds?: string[] | null;
}

export interface ToolDefinition<I = any, O = any> {
  name: string;
  description: string;
  domain: ToolDomain;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  handler: (input: I, ctx: ToolContext) => Promise<O>;
  /** Audit action tag written when the tool runs. */
  auditTag: string;
  /** Non-LLM cost units attributed to a single call of this tool. */
  estimatedCostUnits: number;
  /** Roles permitted to trigger this tool. */
  requiresAuth: AgentRole[];
}

/** Record of a single tool call within an invocation (persisted as JSON). */
export interface ToolCallRecord {
  tool: string;
  args: unknown;
  result?: unknown;
  error?: string;
  costUnits: number;
  ok: boolean;
}
