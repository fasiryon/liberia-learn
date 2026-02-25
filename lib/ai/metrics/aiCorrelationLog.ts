/**
 * lib/ai/metrics/aiCorrelationLog.ts — Block 10
 *
 * Async, non-blocking hook to record whether mastery improved after an
 * AI tutor interaction. Called after the next evidence submission for a
 * student × strand.
 *
 * NO PII — no studentId, no name, no identifier in the payload.
 * Correlation stored as an aggregate MetricEvent (subject + strand + gradeBand).
 * Fire-and-forget: errors are swallowed and logged — never propagated to caller.
 */

import { recordMetricEvent } from "@/lib/metrics/events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorrelationResult = "improved" | "unchanged" | "declined";

export type AiCorrelationInput = {
  schoolId: string | null;
  subject: string;
  strandKey: string;
  gradeBand: string;
  scoreBefore: number;
  scoreAfter: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Score delta thresholds for classifying improvement direction */
const IMPROVEMENT_THRESHOLD = 0.05;
const DECLINE_THRESHOLD = -0.05;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Records the correlation between an AI tutor interaction and the next
 * mastery score change. Non-blocking — does not await the metric write.
 *
 * Safe to call even when MetricEvent table is unavailable; all errors are
 * caught and logged silently.
 */
export function scheduleAiCorrelationCheck(input: AiCorrelationInput): void {
  // Fire-and-forget — never awaited by callers
  recordAiCorrelation(input).catch((err) => {
    console.error("[AI_CORRELATION] Failed to record:", err?.message);
  });
}

export async function recordAiCorrelation(
  input: AiCorrelationInput
): Promise<void> {
  const delta = input.scoreAfter - input.scoreBefore;
  const result: CorrelationResult =
    delta >= IMPROVEMENT_THRESHOLD
      ? "improved"
      : delta <= DECLINE_THRESHOLD
        ? "declined"
        : "unchanged";

  await recordMetricEvent(
    "ai_tutor_correlation",
    {
      subject: input.subject,
      strandKey: input.strandKey,
      gradeBand: input.gradeBand,
      scoreDelta: Math.round(delta * 1000) / 1000,
      correlationResult: result,
      // No studentId — no PII
    },
    {
      scope: "school",
      scopeId: input.schoolId,
      schoolId: input.schoolId,
    }
  );
}
