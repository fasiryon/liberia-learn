/**
 * lib/mastery/baselineService.ts — Block 7B: Adaptive Baseline Service
 *
 * Responsibilities:
 *   1. Get a student's current ability estimate for a given subject × strand.
 *   2. Directly set an ability estimate (manual overrides, initial placement).
 *   3. Record a single piece of assessment evidence and apply an EMA update.
 *
 * Tenant safety:
 *   - Every DB read and write is scoped by BOTH schoolId AND studentId.
 *   - schoolId is always derived from the authenticated session — never from client input.
 *   - No cross-student or cross-school data is read during any operation.
 *
 * Feature flag:
 *   - When ENABLE_ADAPTIVE_BASELINE is off:
 *       getBaseline  → { ability: 0, score: 0.5, disabled: true }
 *       setBaseline  → { disabled: true }  (no-op)
 *       recordEvidenceAndUpdateBaseline → { disabled: true }  (no-op)
 *
 * Telemetry events emitted (no PII — no studentId in payloads):
 *   baseline.updated   — every successful write, tagged with source
 *   baseline.placed    — when source is 'initial' (first placement event)
 *
 * See docs/product/ADAPTIVE_BASELINE.md for the full product reference.
 */

import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { Subject, BaselineSource } from "@prisma/client";
import {
  updateBaseline,
  computeExpectedCorrectness,
  normalizeAbilityToScore,
  ABILITY_MIN,
  ABILITY_MAX,
  type BaselineEvidence,
} from "./baseline";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BaselineIdentifier = {
  /** School the student belongs to. Required for tenant isolation. */
  schoolId: string;
  /** Student's DB id (Student.id — not User.id). */
  studentId: string;
  /** Subject for this baseline estimate. */
  subject: Subject;
  /** Strand key within the subject (must exist in StrandCatalog). */
  strandKey: string;
};

export type GetBaselineResult =
  | { ability: number; score: number; disabled?: never }
  | { ability: 0; score: 0.5; disabled: true };

export type SetBaselineInput = BaselineIdentifier & {
  /**
   * Ability value to store, on the [-2, +2] EMA scale.
   * Will be clamped to [ABILITY_MIN, ABILITY_MAX] before writing.
   */
  ability: number;
  /** How this baseline was established. */
  source: BaselineSource;
  /**
   * ID of the user or system that set this value.
   * Pass the teacher's userId for manual overrides; omit for system-driven updates.
   */
  updatedBy?: string;
};

export type SetBaselineResult =
  | { ability: number; score: number; disabled?: never }
  | { disabled: true };

export type RecordEvidenceInput = BaselineIdentifier & {
  /** Assessment evidence to incorporate into the EMA estimate. */
  evidence: BaselineEvidence;
};

export type RecordEvidenceResult =
  | { ability: number; score: number; expectedCorrectness: number; disabled?: never }
  | { disabled: true };

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Shared telemetry scope constructor — no PII, school-scoped. */
function telemetryScope(schoolId: string) {
  return {
    scope: "school" as const,
    scopeId: schoolId,
    schoolId,
    pilotOnly: true,
  };
}

/** Clamps an ability value to the valid [-2, +2] range before DB writes. */
function safeAbility(value: number): number {
  return Math.max(ABILITY_MIN, Math.min(ABILITY_MAX, value));
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns the student's current ability estimate for a given subject × strand.
 *
 * If no record exists yet, returns ability = 0 (at-grade-level default).
 * If the feature flag is off, returns { ability: 0, score: 0.5, disabled: true }.
 *
 * Never throws for a missing record — a missing baseline is a valid state.
 */
export async function getBaseline(
  input: BaselineIdentifier
): Promise<GetBaselineResult> {
  if (!isFeatureEnabled("ENABLE_ADAPTIVE_BASELINE")) {
    return { ability: 0, score: 0.5, disabled: true };
  }

  const { schoolId, studentId, subject, strandKey } = input;

  const record = await prisma.studentBaselineAbility.findUnique({
    where: {
      StudentBaselineAbility_schoolId_studentId_subject_strandKey_key: {
        schoolId,
        studentId,
        subject,
        strandKey,
      },
    },
    select: { ability: true },
  });

  const ability = record?.ability ?? 0;
  return { ability, score: normalizeAbilityToScore(ability) };
}

/**
 * Directly sets (upserts) a student's ability estimate.
 *
 * Used for:
 *   - Initial placement after an onboarding assessment session.
 *   - Manual teacher overrides.
 *   - Resetting a baseline that is known to be stale.
 *
 * Emits baseline.updated telemetry after every successful write.
 * Emits baseline.placed when source is 'initial'.
 *
 * If the feature flag is off, returns { disabled: true } without writing.
 */
export async function setBaseline(
  input: SetBaselineInput
): Promise<SetBaselineResult> {
  if (!isFeatureEnabled("ENABLE_ADAPTIVE_BASELINE")) {
    return { disabled: true };
  }

  const { schoolId, studentId, subject, strandKey, source, updatedBy } = input;
  const ability = safeAbility(input.ability);
  const now = new Date();

  await prisma.studentBaselineAbility.upsert({
    where: {
      StudentBaselineAbility_schoolId_studentId_subject_strandKey_key: {
        schoolId,
        studentId,
        subject,
        strandKey,
      },
    },
    update: {
      ability,
      source,
      updatedBy: updatedBy ?? null,
      lastUpdatedAt: now,
      updatedAt: now,
    },
    create: {
      schoolId,
      studentId,
      subject,
      strandKey,
      ability,
      source,
      updatedBy: updatedBy ?? null,
      lastUpdatedAt: now,
    },
  });

  const scope = telemetryScope(schoolId);

  // Always emit baseline.updated
  await recordMetricEvent(
    "baseline.updated",
    {
      subject,
      strandKey,
      source,
      ability: Math.round(ability * 1000) / 1000,
      score: Math.round(normalizeAbilityToScore(ability) * 1000) / 1000,
    },
    scope
  );

  // Emit baseline.placed when this is a first placement
  if (source === "initial") {
    await recordMetricEvent(
      "baseline.placed",
      { subject, strandKey, ability: Math.round(ability * 1000) / 1000 },
      scope
    );
  }

  return { ability, score: normalizeAbilityToScore(ability) };
}

/**
 * Applies a single piece of assessment evidence to the student's ability estimate.
 *
 * Algorithm:
 *   1. Load the current ability (default 0 if no record exists yet).
 *   2. Call updateBaseline() (pure EMA function from baseline.ts).
 *   3. Persist the new ability via setBaseline() (emits telemetry).
 *   4. Return the updated ability + expected correctness from before the update.
 *
 * The source is always 'practice' or 'assessment' — never 'initial' or 'manual'.
 *
 * If the feature flag is off, returns { disabled: true } without writing.
 */
export async function recordEvidenceAndUpdateBaseline(
  input: RecordEvidenceInput
): Promise<RecordEvidenceResult> {
  if (!isFeatureEnabled("ENABLE_ADAPTIVE_BASELINE")) {
    return { disabled: true };
  }

  const { schoolId, studentId, subject, strandKey, evidence } = input;

  // 1. Load current ability
  const current = await getBaseline({ schoolId, studentId, subject, strandKey });
  // current.disabled cannot be true here because we checked the flag above
  const prevAbility = (current as { ability: number }).ability;

  // 2. Apply EMA update (pure function — no DB, no side effects)
  const newAbility = updateBaseline(prevAbility, evidence);

  // 3. Determine source from assessmentWeight
  // practice (0.4) → 'practice', quiz (0.6) / exam (1.0) → 'assessment'
  const source: BaselineSource =
    evidence.assessmentWeight <= 0.4 ? "practice" : "assessment";

  // 4. Persist (also emits telemetry)
  await setBaseline({ schoolId, studentId, subject, strandKey, ability: newAbility, source });

  return {
    ability: newAbility,
    score: normalizeAbilityToScore(newAbility),
    // Expected correctness computed from PRE-update ability (useful for debugging / audit)
    expectedCorrectness: computeExpectedCorrectness(prevAbility, evidence.difficulty),
  };
}
