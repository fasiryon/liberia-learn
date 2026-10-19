/**
 * Lesson outcome claims under the Learning outcome standard.
 *
 * LiberiaLearn does not consider a lesson successful because it has been generated, beautifully
 * presented, or completed. A lesson succeeds when students can independently demonstrate that they
 * learned, retained and can apply what it taught.
 *
 * This classifier decides the strongest claim the evidence allows. Delivery evidence (generated,
 * validated, reviewed, published, viewed, completed) never lifts a lesson above DELIVERED. Learning
 * claims need unassisted measurement waves from the pilot measurement plan
 * (docs/curriculum/excellence/PILOT_MEASUREMENT_PLAN_V1.md).
 */

export const PILOT_MEASUREMENT_PLAN_VERSION = "liberialearn-pilot-measurement/1.0.0" as const;

export const MEASUREMENT_WAVES = ["BASELINE", "IMMEDIATE_POST", "DELAYED_RETENTION", "TRANSFER", "EXTERNAL_ANCHOR"] as const;
export type MeasurementWave = (typeof MEASUREMENT_WAVES)[number];

export const DELIVERY_EVIDENCE_KINDS = ["GENERATED", "VALIDATED", "REVIEWED", "PUBLISHED", "PRESENTED", "VIEWED", "COMPLETED"] as const;
export type DeliveryEvidenceKind = (typeof DELIVERY_EVIDENCE_KINDS)[number];

/** Minimum learners with matched responses for a wave to count (pilot plan §Sample). */
export const MIN_MATCHED_LEARNERS = 30;
/** Retention must be measured at least this long after the lesson. */
export const MIN_RETENTION_DELAY_DAYS = 14;

export type MeasuredWave = Readonly<{
  kind: "MEASURED";
  wave: MeasurementWave;
  matchedLearners: number;
  /** Responses collected without hints, AI help, answer exposure or teacher prompting. */
  unassisted: boolean;
  /** Scored without knowledge of group or wave. */
  blindScored: boolean;
  delayDays?: number;
  comparison: "NONE" | "BASELINE_ONLY" | "COMPARISON_GROUP" | "RANDOMIZED";
  /** Standardized gain over BASELINE (or over the comparison group), with its 95% interval lower bound. */
  effect: Readonly<{ estimate: number; ciLower95: number }> | null;
}>;

export type OutcomeEvidence = Readonly<{ kind: DeliveryEvidenceKind }> | MeasuredWave;

export const LESSON_OUTCOME_STATUSES = [
  "NO_EVIDENCE", "DELIVERED", "LEARNING_OBSERVED", "LEARNING_RETAINED", "LEARNING_SUCCESS_DEMONSTRATED",
] as const;
export type LessonOutcomeStatus = (typeof LESSON_OUTCOME_STATUSES)[number];

export type LessonOutcomeClassification = Readonly<{
  planVersion: typeof PILOT_MEASUREMENT_PLAN_VERSION;
  status: LessonOutcomeStatus;
  /** True only for LEARNING_SUCCESS_DEMONSTRATED. */
  maySayLessonSucceeded: boolean;
  missing: readonly string[];
  excluded: readonly string[];
}>;

export function classifyLessonOutcome(evidence: readonly OutcomeEvidence[]): LessonOutcomeClassification {
  const excluded: string[] = [];
  const usable = new Map<MeasurementWave, MeasuredWave>();
  let delivered = false;
  for (const item of evidence) {
    if (item.kind !== "MEASURED") { delivered = true; continue; }
    if (!item.unassisted) { excluded.push(`${item.wave}:ASSISTED`); continue; }
    if (item.matchedLearners < MIN_MATCHED_LEARNERS) { excluded.push(`${item.wave}:UNDER_${MIN_MATCHED_LEARNERS}_LEARNERS`); continue; }
    if (item.wave === "DELAYED_RETENTION" && (item.delayDays ?? 0) < MIN_RETENTION_DELAY_DAYS) { excluded.push(`${item.wave}:DELAY_UNDER_${MIN_RETENTION_DELAY_DAYS}_DAYS`); continue; }
    usable.set(item.wave, item);
  }
  const gained = (wave: MeasurementWave) => {
    const item = usable.get(wave);
    return !!item && !!item.effect && item.effect.ciLower95 > 0;
  };
  const missing: string[] = [];
  if (!usable.has("BASELINE")) missing.push("BASELINE");
  if (!gained("IMMEDIATE_POST")) missing.push("IMMEDIATE_POST_GAIN");
  if (!gained("DELAYED_RETENTION")) missing.push("RETAINED_GAIN");
  if (!gained("TRANSFER")) missing.push("TRANSFER_GAIN");
  const anchor = usable.get("EXTERNAL_ANCHOR");
  const comparable = !!anchor && anchor.blindScored && (anchor.comparison === "COMPARISON_GROUP" || anchor.comparison === "RANDOMIZED") && gained("EXTERNAL_ANCHOR");
  if (!comparable) missing.push("INDEPENDENTLY_COMPARABLE_GAIN");

  const observed = usable.has("BASELINE") && gained("IMMEDIATE_POST");
  const retained = observed && gained("DELAYED_RETENTION");
  const success = retained && gained("TRANSFER") && comparable;
  const status: LessonOutcomeStatus = success ? "LEARNING_SUCCESS_DEMONSTRATED"
    : retained ? "LEARNING_RETAINED"
    : observed ? "LEARNING_OBSERVED"
    : delivered || usable.size > 0 ? "DELIVERED"
    : "NO_EVIDENCE";
  return Object.freeze({
    planVersion: PILOT_MEASUREMENT_PLAN_VERSION,
    status,
    maySayLessonSucceeded: success,
    missing: Object.freeze(missing),
    excluded: Object.freeze(excluded),
  });
}
