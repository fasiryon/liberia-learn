/**
 * lib/reporting/monthly/compute.ts — Block 8: Monthly Report Computation Library
 *
 * Pure functions for:
 *   1. Aggregating raw StudentMasteryProfile rows by subject × strand.
 *   2. Classifying each strand into an internal performance tier (A–D).
 *   3. Computing school/national headline metrics from strand aggregates.
 *   4. Counting tier distributions.
 *   5. Month boundary utilities.
 *
 * ⚠️  TIER DATA IS INTERNAL ONLY (see ADR-0009):
 *   Tier labels (A–D) and tierCounts are for teacher/admin intervention targeting.
 *   They MUST NOT appear in public-facing endpoints, student-facing views,
 *   guardian messages, or any document that ranks schools against each other.
 *   Public reporting exposes system-wide averages only.
 *
 * Design:
 *   - Pure: no DB access, no side effects, no randomness.
 *   - Deterministic: same inputs always produce the same output.
 *   - All thresholds are exported constants for test introspection.
 */

// ─── Tier thresholds ─────────────────────────────────────────────────────────

/**
 * Fraction of students with ProficiencyState = PROFICIENT required to qualify
 * a strand as "high proficiency" (Tier A left condition).
 */
export const TIER_HIGH_PROFICIENCY = 0.75;

/**
 * Fraction of students with ProficiencyState = PROFICIENT below which a strand
 * is "low proficiency" (Tier C left condition).
 */
export const TIER_LOW_PROFICIENCY = 0.60;

/**
 * Average growth delta (currentScore − baselineScore) qualifying as "high growth"
 * (Tier A right condition and Tier B left condition).
 */
export const TIER_HIGH_GROWTH = 0.10;

/**
 * Average growth delta below which a strand is "stagnant"
 * (Tier C right condition and Tier D right condition).
 */
export const TIER_STAGNANT_GROWTH = 0.05;

/**
 * Average baseline score qualifying as "high baseline"
 * (Tier D left condition — strong start, now plateaued).
 */
export const TIER_HIGH_BASELINE = 0.70;

/**
 * Average baseline score below which a strand is "low baseline"
 * (Tier B right condition — started behind, improving rapidly).
 */
export const TIER_LOW_BASELINE = 0.50;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Internal tier label for per-strand classification. INTERNAL ONLY — ADR-0009.
 *
 * A — High proficiency + high growth: outstanding strands.
 * B — High growth + low baseline: strong improvers from a low start.
 * C — Low proficiency + stagnant growth: strands needing immediate intervention.
 * D — High baseline + stagnant growth: plateaued strands needing enrichment.
 * unclassified — Acceptable performance range; no specific tier action needed.
 */
export type TierLabel = "A" | "B" | "C" | "D" | "unclassified";

/**
 * A single raw mastery profile row as needed by the aggregation functions.
 * Only the fields used in computation are required.
 */
export type MasteryProfileRow = {
  subject: string;
  strandKey: string;
  currentScore: number;
  baselineScore: number;
  /** growthDelta = currentScore − baselineScore (computed by aggregationService). */
  growthDelta: number;
  sustainabilityIndex: number;
  aiRelianceRate: number;
  proficiencyState: string; // "NOT_ASSESSED" | "BELOW_PROFICIENT" | "APPROACHING" | "PROFICIENT"
  masteryState: string;     // "NOT_ASSESSED" | "DEVELOPING" | "APPROACHING" | "MASTERED" | "DECAYING"
};

/**
 * Aggregate metrics for a single subject × strand.
 * INTERNAL: tierLabel must not appear in public API responses.
 */
export type StrandAggregate = {
  subject: string;
  strandKey: string;
  /** Fraction of assessed students with proficiencyState = PROFICIENT. */
  proficiencyRate: number;
  /** Fraction of assessed students with masteryState = MASTERED. */
  masteryRate: number;
  /** Mean growthDelta (currentScore − baselineScore) across students. */
  avgGrowthDelta: number;
  /** Mean sustainabilityIndex across students. */
  avgSustainabilityIndex: number;
  /** Mean aiRelianceRate across students. */
  avgAiRelianceRate: number;
  /** Mean baselineScore across students. */
  avgBaselineScore: number;
  /** Number of students with mastery data for this strand. */
  studentCount: number;
  /** Internal tier. INTERNAL ONLY — see ADR-0009. */
  tier: TierLabel;
};

/** Headline metrics for the entire report (weighted across strands). */
export type ReportHeadlineMetrics = {
  proficiencyRate: number;
  masteryRate: number;
  avgGrowthDelta: number;
  sustainabilityIndex: number;
  aiRelianceRate: number;
};

/** Per-tier strand counts. INTERNAL ONLY — see ADR-0009. */
export type TierCounts = {
  A: number;
  B: number;
  C: number;
  D: number;
  unclassified: number;
};

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Groups raw mastery profile rows by subject × strandKey and computes
 * per-strand aggregate metrics, including tier classification.
 *
 * Rows are expected to represent all students in the reporting scope.
 * If a student has no profile for a strand, they simply don't appear in
 * that strand's aggregate (no imputation).
 *
 * Output is sorted deterministically: by subject ASC, then strandKey ASC.
 *
 * @param rows  Raw mastery profile rows for all students in the scope.
 * @returns     Per-strand aggregates with tier labels.
 */
export function aggregateByStrand(rows: MasteryProfileRow[]): StrandAggregate[] {
  if (rows.length === 0) return [];

  // Group rows by composite key
  const groups = new Map<string, MasteryProfileRow[]>();
  for (const row of rows) {
    const key = `${row.subject}:::${row.strandKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const aggregates: StrandAggregate[] = [];

  for (const [, group] of groups) {
    const n = group.length;
    const first = group[0];

    const proficiencyRate =
      group.filter((r) => r.proficiencyState === "PROFICIENT").length / n;
    const masteryRate =
      group.filter((r) => r.masteryState === "MASTERED").length / n;
    const avgGrowthDelta =
      group.reduce((sum, r) => sum + r.growthDelta, 0) / n;
    const avgSustainabilityIndex =
      group.reduce((sum, r) => sum + r.sustainabilityIndex, 0) / n;
    const avgAiRelianceRate =
      group.reduce((sum, r) => sum + r.aiRelianceRate, 0) / n;
    const avgBaselineScore =
      group.reduce((sum, r) => sum + r.baselineScore, 0) / n;

    const strandData = {
      subject: first.subject,
      strandKey: first.strandKey,
      proficiencyRate,
      masteryRate,
      avgGrowthDelta,
      avgSustainabilityIndex,
      avgAiRelianceRate,
      avgBaselineScore,
      studentCount: n,
    };

    aggregates.push({
      ...strandData,
      tier: classifyStrandTier(strandData),
    });
  }

  // Deterministic sort: subject ASC, strandKey ASC
  return aggregates.sort((a, b) =>
    a.subject !== b.subject
      ? a.subject.localeCompare(b.subject)
      : a.strandKey.localeCompare(b.strandKey)
  );
}

/**
 * Classifies a strand into one of the 4 internal tiers (A–D), checked in priority order.
 *
 * Tier definitions:
 *   A — proficiencyRate ≥ 0.75 AND avgGrowthDelta ≥ 0.10
 *       Outstanding: high current performance with strong growth momentum.
 *       Action: celebrate and sustain.
 *
 *   B — avgGrowthDelta ≥ 0.10 AND avgBaselineScore < 0.50
 *       Improvers: started behind but growing rapidly.
 *       Action: support growth trajectory; prevent plateau.
 *
 *   C — proficiencyRate < 0.60 AND avgGrowthDelta < 0.05
 *       At-risk: low current performance AND stagnant growth.
 *       Action: immediate targeted intervention.
 *
 *   D — avgBaselineScore ≥ 0.70 AND avgGrowthDelta < 0.05
 *       Plateaued: strong baseline but growth has stalled.
 *       Action: enrichment and challenge content to re-engage.
 *
 *   unclassified — Does not meet any tier criteria.
 *       Acceptable performance; monitor normally.
 *
 * ⚠️  INTERNAL ONLY — see ADR-0009. Must not appear in public API responses.
 */
export function classifyStrandTier(
  strand: Omit<StrandAggregate, "tier">
): TierLabel {
  const { proficiencyRate, avgGrowthDelta, avgBaselineScore } = strand;

  // Tier A: high proficiency AND high growth
  if (
    proficiencyRate >= TIER_HIGH_PROFICIENCY &&
    avgGrowthDelta >= TIER_HIGH_GROWTH
  ) {
    return "A";
  }

  // Tier B: high growth AND low baseline (rapid improvement from behind)
  if (
    avgGrowthDelta >= TIER_HIGH_GROWTH &&
    avgBaselineScore < TIER_LOW_BASELINE
  ) {
    return "B";
  }

  // Tier C: low proficiency AND stagnant growth (needs intervention)
  if (
    proficiencyRate < TIER_LOW_PROFICIENCY &&
    avgGrowthDelta < TIER_STAGNANT_GROWTH
  ) {
    return "C";
  }

  // Tier D: high baseline AND stagnant growth (plateaued)
  if (
    avgBaselineScore >= TIER_HIGH_BASELINE &&
    avgGrowthDelta < TIER_STAGNANT_GROWTH
  ) {
    return "D";
  }

  return "unclassified";
}

/**
 * Computes headline metrics from per-strand aggregates, weighted by student count.
 *
 * Strands with more assessed students contribute proportionally more to the
 * headline figures. This avoids strands with 1–2 students skewing the result.
 *
 * Returns zero-filled defaults when there are no strands or total weight = 0.
 */
export function computeHeadlineMetrics(
  strands: StrandAggregate[]
): ReportHeadlineMetrics {
  const totalWeight = strands.reduce((s, st) => s + st.studentCount, 0);

  if (strands.length === 0 || totalWeight === 0) {
    return {
      proficiencyRate: 0,
      masteryRate: 0,
      avgGrowthDelta: 0,
      sustainabilityIndex: 0,
      aiRelianceRate: 0,
    };
  }

  const weighted = (fn: (st: StrandAggregate) => number): number =>
    strands.reduce((s, st) => s + fn(st) * st.studentCount, 0) / totalWeight;

  return {
    proficiencyRate:    weighted((st) => st.proficiencyRate),
    masteryRate:        weighted((st) => st.masteryRate),
    avgGrowthDelta:     weighted((st) => st.avgGrowthDelta),
    sustainabilityIndex: weighted((st) => st.avgSustainabilityIndex),
    aiRelianceRate:     weighted((st) => st.avgAiRelianceRate),
  };
}

/**
 * Counts the number of strands in each tier.
 * INTERNAL ONLY — see ADR-0009. Must not appear in public API responses.
 */
export function computeTierCounts(strands: StrandAggregate[]): TierCounts {
  const counts: TierCounts = { A: 0, B: 0, C: 0, D: 0, unclassified: 0 };
  for (const strand of strands) {
    counts[strand.tier] += 1;
  }
  return counts;
}

// ─── Month utilities ──────────────────────────────────────────────────────────

/**
 * Formats year + 1-indexed month as "YYYY-MM".
 *
 * @example formatReportMonth(2026, 1)  → "2026-01"
 * @example formatReportMonth(2026, 12) → "2026-12"
 */
export function formatReportMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Returns the previous calendar month as "YYYY-MM".
 * Useful for cron jobs that run on the 1st of each month.
 */
export function getPreviousMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCDate(0); // last day of the previous month
  return formatReportMonth(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/**
 * Returns the start and end of a reporting month as UTC Date objects.
 *
 * Used to filter mastery profiles updated within the reporting period.
 *
 * @param reportMonth  "YYYY-MM" string (e.g. "2026-01").
 */
export function getMonthBounds(reportMonth: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = reportMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  // Last millisecond of the last day of the month
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Validates that a string is a well-formed "YYYY-MM" report month.
 * Returns false for invalid formats, out-of-range months, or future months.
 */
export function isValidReportMonth(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const [yearStr, monthStr] = month.split("-");
  const y = Number(yearStr);
  const m = Number(monthStr);
  return m >= 1 && m <= 12 && y >= 2020;
}
