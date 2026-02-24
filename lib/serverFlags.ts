/**
 * Server-side-only feature flags.
 *
 * These are NOT NEXT_PUBLIC_ prefixed — they are never inlined into the
 * client bundle by Next.js. Do NOT import this module in any file marked
 * "use client" or in any code that runs in the browser.
 *
 * Flags are read from process.env at call-time so tests can mutate
 * process.env between assertions without requiring module resets.
 *
 * See docs/ops/FEATURE_FLAGS.md for the full flag catalogue.
 */

/** Severity levels in ascending order for threshold comparisons. */
export const SEVERITY_LEVELS = ["info", "warn", "critical"] as const;
export type FindingSeverity = (typeof SEVERITY_LEVELS)[number];

/**
 * Returns true when `findingSeverity` is >= `minSeverity`.
 * Unknown severities are treated as "info" (lowest).
 */
export function severityMeetsThreshold(
  findingSeverity: string,
  minSeverity: string
): boolean {
  const findingIdx = SEVERITY_LEVELS.indexOf(findingSeverity as FindingSeverity);
  const minIdx = SEVERITY_LEVELS.indexOf(minSeverity as FindingSeverity);
  // If either level is unrecognised, resolve conservatively
  const fi = findingIdx === -1 ? 0 : findingIdx;
  const mi = minIdx === -1 ? 1 : minIdx; // unknown min defaults to "warn"
  return fi >= mi;
}

/**
 * Whether the OpenAI-powered ops explanation endpoint is enabled.
 * Default: false.  Set OPS_AI_EXPLANATIONS_ENABLED=true to enable.
 */
export function isOpsAiEnabled(): boolean {
  return process.env.OPS_AI_EXPLANATIONS_ENABLED === "true";
}

/**
 * Minimum finding severity required for an AI explanation to be generated.
 * Default: "warn".  Set OPS_AI_MIN_SEVERITY=info|warn|critical.
 */
export function getOpsAiMinSeverity(): FindingSeverity {
  const raw = process.env.OPS_AI_MIN_SEVERITY ?? "warn";
  return SEVERITY_LEVELS.includes(raw as FindingSeverity)
    ? (raw as FindingSeverity)
    : "warn";
}
