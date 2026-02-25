/**
 * lib/signals/interventions/interventionEngine.ts — Block 12B: Intervention Alerts
 *
 * Computes class-level intervention alerts from aggregate mastery signals.
 * No student identifiers in inputs or outputs — all signals are class-level.
 *
 * Design:
 *   - Pure computation layer (computeInterventionAlerts) is fully testable without DB.
 *   - DB fetch layer (fetchClassAggregatesForSchool) is mockable in tests.
 *   - No student IDs, names, or row-level data returned.
 *   - No school ranking — signals are per-class advisory alerts only.
 *   - Feature-flagged: ENABLE_INTERVENTION_ALERTS (default OFF).
 *
 * Signal types:
 *   - low_mastery_persistence: ≥50% of class profiles at DEVELOPING/BELOW_PROFICIENT
 *   - negative_growth:         mean growth delta is negative (class regressing)
 *   - low_proficiency_rate:    proficiency rate < 50% and no improvement trend
 *   - stagnation:              mastery delta < 2pp for high-confidence sample
 *
 * See docs/product/WORKFLOW_AI.md for governance rules.
 */

import { prisma } from "@/lib/db";
import { mean } from "@/lib/metrics/impact/statRules";
import { isValidPeriod, parseMonthStart, parseMonthEnd } from "./periodHelpers";

export { isValidPeriod };

// ─── Types ────────────────────────────────────────────────────────────────────

export type InterventionSignalType =
  | "low_mastery_persistence"
  | "negative_growth"
  | "low_proficiency_rate"
  | "stagnation";

export type InterventionSeverity = "info" | "warning" | "critical";

export type InterventionAlert = {
  type: InterventionSignalType;
  severity: InterventionSeverity;
  message: string;
  /** Class or school — NEVER student-level. */
  scope: "class" | "school";
  /** classId or schoolId. Never a studentId. */
  scopeId: string;
  /** Human-readable scope name (class name or school name). */
  scopeName: string;
  /** Aggregate metric that triggered this alert. */
  triggerValue: number;
};

export type ClassAggregate = {
  classId: string;
  className: string;
  /** Total mastery profiles in this class. */
  profileCount: number;
  /** Fraction with DEVELOPING or BELOW_PROFICIENT state (0–1). */
  lowMasteryFraction: number;
  /** Mean (currentScore − baselineScore) across all profiles. */
  meanGrowthDelta: number;
  /** Fraction of profiles at PROFICIENT state (0–1). */
  proficiencyRate: number;
  /** Mean(currentScore) − Mean(baselineScore) at class level. */
  masteryDelta: number;
};

// ─── Thresholds (deterministic rules) ─────────────────────────────────────────

/** Fraction of DEVELOPING/BELOW_PROFICIENT profiles to trigger low_mastery_persistence. */
const LOW_MASTERY_FRACTION_WARNING = 0.50;
const LOW_MASTERY_FRACTION_CRITICAL = 0.75;

/** Proficiency rate below which to consider low_proficiency_rate. */
const LOW_PROFICIENCY_RATE_THRESHOLD = 0.50;

/** Mastery delta below which (with sufficient sample) to flag stagnation. */
const STAGNATION_DELTA_THRESHOLD = 0.02;

/** Minimum profiles in a class to emit any alert. */
const MIN_CLASS_PROFILES = 3;

// ─── Pure computation layer ────────────────────────────────────────────────────

/**
 * Derives intervention alerts from class-level aggregates.
 * Pure function — no DB access, no side effects.
 * Suitable for direct unit testing.
 */
export function computeInterventionAlerts(
  classAggregates: ClassAggregate[]
): InterventionAlert[] {
  const alerts: InterventionAlert[] = [];

  for (const cls of classAggregates) {
    if (cls.profileCount < MIN_CLASS_PROFILES) continue;

    // Signal 1: low mastery persistence
    if (cls.lowMasteryFraction >= LOW_MASTERY_FRACTION_CRITICAL) {
      alerts.push({
        type: "low_mastery_persistence",
        severity: "critical",
        message: `${Math.round(cls.lowMasteryFraction * 100)}% of class profiles are at DEVELOPING or BELOW_PROFICIENT level.`,
        scope: "class",
        scopeId: cls.classId,
        scopeName: cls.className,
        triggerValue: cls.lowMasteryFraction,
      });
    } else if (cls.lowMasteryFraction >= LOW_MASTERY_FRACTION_WARNING) {
      alerts.push({
        type: "low_mastery_persistence",
        severity: "warning",
        message: `${Math.round(cls.lowMasteryFraction * 100)}% of class profiles are at DEVELOPING or BELOW_PROFICIENT level.`,
        scope: "class",
        scopeId: cls.classId,
        scopeName: cls.className,
        triggerValue: cls.lowMasteryFraction,
      });
    }

    // Signal 2: negative growth
    if (cls.meanGrowthDelta < 0) {
      alerts.push({
        type: "negative_growth",
        severity: cls.meanGrowthDelta < -0.05 ? "critical" : "warning",
        message: `Class mean growth delta is ${(cls.meanGrowthDelta * 100).toFixed(1)}pp — scores are declining from baseline.`,
        scope: "class",
        scopeId: cls.classId,
        scopeName: cls.className,
        triggerValue: cls.meanGrowthDelta,
      });
    }

    // Signal 3: low proficiency rate (with no positive improvement)
    if (
      cls.proficiencyRate < LOW_PROFICIENCY_RATE_THRESHOLD &&
      cls.masteryDelta <= 0
    ) {
      alerts.push({
        type: "low_proficiency_rate",
        severity: cls.proficiencyRate < 0.25 ? "critical" : "info",
        message: `Proficiency rate is ${Math.round(cls.proficiencyRate * 100)}% with no improvement trend detected.`,
        scope: "class",
        scopeId: cls.classId,
        scopeName: cls.className,
        triggerValue: cls.proficiencyRate,
      });
    }

    // Signal 4: stagnation (sufficient sample + very small delta)
    if (
      cls.profileCount >= 10 &&
      Math.abs(cls.masteryDelta) < STAGNATION_DELTA_THRESHOLD &&
      cls.masteryDelta >= 0
    ) {
      alerts.push({
        type: "stagnation",
        severity: "info",
        message: `Class mastery delta is less than ${STAGNATION_DELTA_THRESHOLD * 100}pp — limited measurable progress this period.`,
        scope: "class",
        scopeId: cls.classId,
        scopeName: cls.className,
        triggerValue: cls.masteryDelta,
      });
    }
  }

  // Sort: critical → warning → info, then by scopeName
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    return diff !== 0 ? diff : a.scopeName.localeCompare(b.scopeName);
  });
}

// ─── DB fetch layer ────────────────────────────────────────────────────────────

/**
 * Fetches class-level aggregate data for a school within a period range.
 * Returns ClassAggregate[] — no student identifiers.
 */
export async function fetchClassAggregatesForSchool(
  schoolId: string,
  periodRange: { from: string; to: string }
): Promise<ClassAggregate[]> {
  const periodStart = parseMonthStart(periodRange.from);
  const periodEnd = parseMonthEnd(periodRange.to);

  // Fetch all classes for this school
  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, name: true, subject: true },
  });

  const aggregates: ClassAggregate[] = [];

  for (const cls of classes) {
    const profiles = await prisma.studentMasteryProfile.findMany({
      where: {
        student: {
          enrollments: { some: { classId: cls.id } },
        },
        lastAssessedAt: { gte: periodStart, lte: periodEnd },
      } as any,
      select: {
        baselineScore: true,
        currentScore: true,
        proficiencyState: true,
        masteryState: true,
      },
    } as any);

    const p = profiles as Array<{
      baselineScore: number;
      currentScore: number;
      proficiencyState: string;
      masteryState: string;
    }>;

    if (p.length === 0) continue;

    const LOW_STATES = ["DEVELOPING", "BELOW_PROFICIENT", "NOT_ASSESSED"];
    const lowCount = p.filter((x) => LOW_STATES.includes(x.masteryState)).length;
    const proficientCount = p.filter((x) => x.proficiencyState === "PROFICIENT").length;
    const deltas = p.map((x) => x.currentScore - x.baselineScore);
    const currentScores = p.map((x) => x.currentScore);
    const baselineScores = p.map((x) => x.baselineScore);

    aggregates.push({
      classId: cls.id,
      className: cls.name,
      profileCount: p.length,
      lowMasteryFraction: lowCount / p.length,
      meanGrowthDelta: mean(deltas),
      proficiencyRate: proficientCount / p.length,
      masteryDelta: mean(currentScores) - mean(baselineScores),
    });
  }

  return aggregates;
}
