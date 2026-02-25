/**
 * lib/metrics/impact/statRules.ts — Block 12A: Deterministic Significance Rules
 *
 * Pure, stateless functions encoding all thresholds for impact measurement.
 *
 * Design:
 *   - All functions are pure (no DB access, no side effects, no randomness).
 *   - All thresholds are named constants — change them here, tests catch regressions.
 *   - No PII accepted or returned.
 *   - Exported for direct unit testing.
 *
 * See docs/product/IMPACT_ENGINE.md for full definitions and governance rationale.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLabel = "low" | "medium" | "high";

// ─── Sample size thresholds ────────────────────────────────────────────────────

/** Absolute minimum. Below this → low confidence, never statistically meaningful. */
export const MIN_SAMPLE_SIZE = 5;

/** Minimum for medium confidence (10 profiles). */
export const MEDIUM_CONFIDENCE_THRESHOLD = 10;

/** Minimum for high confidence (30 profiles). */
export const HIGH_CONFIDENCE_THRESHOLD = 30;

// ─── Significance thresholds ───────────────────────────────────────────────────

/**
 * Minimum mastery score delta (0–1) to be considered potentially meaningful.
 * 0.05 = 5 percentage points improvement.
 */
export const MEANINGFUL_DELTA_THRESHOLD = 0.05;

/**
 * Minimum Cohen's d effect size (absolute value) to confirm significance.
 * 0.20 = "small" effect — deliberate low bar for education contexts.
 */
export const MEANINGFUL_EFFECT_SIZE_MIN = 0.20;

/**
 * Minimum fraction of profiles showing positive growth delta.
 * 0.60 = at least 60% of measured students improved.
 * Prevents a small subset of high gains from masking class-wide stagnation.
 */
export const MEANINGFUL_GROWTH_FRACTION = 0.60;

// ─── Pure computation functions ────────────────────────────────────────────────

/**
 * Classifies a sample size into a confidence label.
 *   < 10 → "low"    (insufficient data; treat results as directional only)
 *   10–29 → "medium" (indicative; caution advised)
 *   ≥ 30 → "high"   (sufficient for administrative use)
 */
export function classifyConfidence(sampleSize: number): ConfidenceLabel {
  if (sampleSize < MEDIUM_CONFIDENCE_THRESHOLD) return "low";
  if (sampleSize < HIGH_CONFIDENCE_THRESHOLD) return "medium";
  return "high";
}

/**
 * Computes the arithmetic mean of an array.
 * Returns 0 for empty arrays (no throw — callers handle empty datasets).
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/**
 * Computes population variance.
 * Returns 0 for fewer than 2 values (variance undefined for a single point).
 */
export function populationVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
}

/**
 * Computes Cohen's d effect size between two groups.
 *
 * d = (mean(comparison) − mean(baseline)) / pooledSD
 *
 * Pooled SD uses the average of the two population variances (equal weight).
 * Returns null if either group has fewer than 2 values, or pooledSD = 0
 * (constant scores — effect size is undefined, not zero).
 *
 * Interpretation of |d|:
 *   < 0.2  → negligible
 *   0.2–0.5 → small
 *   0.5–0.8 → medium
 *   ≥ 0.8  → large
 */
export function computeEffectSize(
  baseline: number[],
  comparison: number[]
): number | null {
  if (baseline.length < 2 || comparison.length < 2) return null;
  const pooledVar = (populationVariance(baseline) + populationVariance(comparison)) / 2;
  const pooledSD = Math.sqrt(pooledVar);
  if (pooledSD === 0) return null;
  return (mean(comparison) - mean(baseline)) / pooledSD;
}

/**
 * Determines whether improvement is statistically meaningful using
 * deterministic rules only (no probabilistic testing).
 *
 * All conditions must be satisfied simultaneously:
 *   1. sampleSize ≥ MIN_SAMPLE_SIZE (5)
 *   2. masteryDelta ≥ MEANINGFUL_DELTA_THRESHOLD (0.05)
 *   3. growthFraction ≥ MEANINGFUL_GROWTH_FRACTION (0.60)
 *   4. |effectSize| ≥ MEANINGFUL_EFFECT_SIZE_MIN (0.20)
 *      — OR — effectSize is null AND confidence is "high" AND delta ≥ 2×threshold
 *      (null effectSize can occur with <2 samples per group; allow high-confidence override)
 *
 * Returns false immediately if sampleSize < MIN_SAMPLE_SIZE.
 */
export function isStatisticallyMeaningful({
  sampleSize,
  masteryDelta,
  effectSize,
  growthFraction,
}: {
  sampleSize: number;
  masteryDelta: number;
  effectSize: number | null;
  growthFraction: number;
}): boolean {
  if (sampleSize < MIN_SAMPLE_SIZE) return false;
  if (masteryDelta < MEANINGFUL_DELTA_THRESHOLD) return false;
  if (growthFraction < MEANINGFUL_GROWTH_FRACTION) return false;

  if (effectSize === null) {
    // No effect size computable — allow only with high confidence + strong delta
    return (
      sampleSize >= HIGH_CONFIDENCE_THRESHOLD &&
      masteryDelta >= MEANINGFUL_DELTA_THRESHOLD * 2
    );
  }

  return Math.abs(effectSize) >= MEANINGFUL_EFFECT_SIZE_MIN;
}
