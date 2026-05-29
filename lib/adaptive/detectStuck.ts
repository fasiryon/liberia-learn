/**
 * lib/adaptive/detectStuck.ts  — NR-14B Phase 2
 *
 * Pure function: detects whether a student is stuck on a lesson.
 * Three signals. Any one firing = stuck.
 *
 * No DB calls — safe to use in tests without mocking prisma.
 */

export type StuckSignal =
  | "wrong_answers"
  | "slow_response"
  | "repeat_attempts";

export type StuckCheck = {
  isStuck: boolean;
  signal?: StuckSignal;
  detail?: Record<string, unknown>;
};

export const THRESHOLDS = {
  wrongAnswers: 3,
  slowResponseMultiplier: 2,
  baselineResponseMs: 90_000,
  repeatAttempts: 3,
  lowerGradeMultiplier: 1.5, // lower-band students get 50% more time
} as const;

/**
 * Detect whether a student is stuck during a lesson/quiz.
 *
 * @param wrongCount      Number of wrong answers so far this session
 * @param lastResponseMs  Time taken for the most recent question (ms)
 * @param attemptCount    Number of attempts on the current question
 * @param gradeBand       "lower" (G1-3) or "upper" (G4-12); affects time threshold
 */
export function detectStuck(input: {
  wrongCount: number;
  lastResponseMs: number;
  attemptCount: number;
  gradeBand?: "lower" | "upper";
}): StuckCheck {
  const { wrongCount, lastResponseMs, attemptCount, gradeBand = "upper" } = input;

  // Adjust baseline for lower grades (longer time expected)
  const baseline =
    gradeBand === "lower"
      ? THRESHOLDS.baselineResponseMs * THRESHOLDS.lowerGradeMultiplier
      : THRESHOLDS.baselineResponseMs;

  const slowThreshold = baseline * THRESHOLDS.slowResponseMultiplier;

  // Priority 1: multiple wrong answers (most reliable signal)
  if (wrongCount >= THRESHOLDS.wrongAnswers) {
    return {
      isStuck: true,
      signal: "wrong_answers",
      detail: { wrongCount },
    };
  }

  // Priority 2: repeated attempts on same question
  if (attemptCount >= THRESHOLDS.repeatAttempts) {
    return {
      isStuck: true,
      signal: "repeat_attempts",
      detail: { attemptCount },
    };
  }

  // Priority 3: very slow response (≥2× expected time)
  if (lastResponseMs >= slowThreshold) {
    return {
      isStuck: true,
      signal: "slow_response",
      detail: { responseMs: lastResponseMs, thresholdMs: slowThreshold },
    };
  }

  return { isStuck: false };
}
