/**
 * lib/mastery/masteryService.ts — Block 7A: Mastery Update Service
 *
 * Responsibilities:
 *   1. Accept a new attempt event (score, AI-assisted flag, timing).
 *   2. Load or initialise the StudentMasteryProfile for (studentId, subject, strandKey).
 *   3. Recalculate all derived metrics via pure functions from compute.ts.
 *   4. Upsert the updated profile to the DB.
 *   5. Emit telemetry events (no PII in payloads).
 *
 * Tenant safety:
 *   - Every DB write is scoped by studentId (which FK-chains to a school via Student → User).
 *   - schoolId is required in input for telemetry scoping; it is never used as the
 *     sole predicate for student data queries.
 *   - No cross-student or cross-school data is read during an update.
 *
 * Telemetry events emitted (no PII):
 *   mastery.updated       — every successful profile update
 *   mastery.at_risk       — student BELOW_PROFICIENT or DECAYING
 *   ai.reliance.changed   — aiRelianceRate changes by > AI_RELIANCE_DELTA_THRESHOLD
 *   decay.detected        — decayRate crosses DECAY_ALERT_THRESHOLD
 *
 * Offline-first note:
 *   This service is server-side only. It is called from API routes that receive
 *   synced attempt data (including offline queue flushes). It does not modify
 *   the offline queue itself.
 */

import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import type { Subject, GradeBand, ProficiencyState, MasteryState } from "@prisma/client";
import {
  computeProficiencyState,
  computeMasteryState,
  computeGrowthDelta,
  computeSustainabilityIndex,
  computeDecayRate,
  computeAiRelianceRate,
  computeHybridScoreByGradeBand,
  DECAY_ALERT_THRESHOLD,
} from "./compute";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Number of most-recent assessment scores to use for sustainability / decay
 * calculations. Keeps the window manageable for low-frequency assessments.
 */
const SCORE_WINDOW = 10;

/**
 * Minimum change in aiRelianceRate (absolute) before emitting ai.reliance.changed.
 * Prevents noisy events for micro-fluctuations.
 */
const AI_RELIANCE_DELTA_THRESHOLD = 0.05;

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateMasteryInput = {
  /** Student's DB id (Student.id — not User.id). Scopes the profile write. */
  studentId: string;
  /** School the student belongs to. Used for telemetry scoping only (no PII). */
  schoolId: string;
  /** Subject this attempt is for. */
  subject: Subject;
  /** Strand key within the subject (must exist in StrandCatalog). */
  strandKey: string;
  /** Grade band for the hybrid scoring model. */
  gradeBand: GradeBand;
  /**
   * Normalised score for this attempt: 0.0 (all wrong) to 1.0 (all correct).
   * This is the raw unaided score; AI reliance tracking is separate.
   */
  newScore: number;
  /** True if the student invoked AI assistance during this attempt. */
  wasAiAssisted: boolean;
  /**
   * Recent scores in chronological order (including newScore as the last entry).
   * Caller is responsible for maintaining this window (max SCORE_WINDOW items).
   * If not provided, the service will use only newScore.
   */
  recentScores?: number[];
  /**
   * Days elapsed between each consecutive pair of scores in recentScores.
   * Length must be recentScores.length − 1.
   * Defaults to [1] (one day) if not provided.
   */
  daysBetweenScores?: number[];
  /**
   * Total number of AI-assisted attempts ever recorded for this student × strand
   * (across all time, not just the current window). Used to compute aiRelianceRate.
   */
  totalAttempts: number;
  /** Total AI-assisted attempts (cumulative, same scope as totalAttempts). */
  aiAssistedAttempts: number;
};

export type MasteryUpdateResult = {
  profileId: string;
  studentId: string;
  subject: Subject;
  strandKey: string;
  currentScore: number;
  proficiencyState: ProficiencyState;
  masteryState: MasteryState;
  sustainabilityIndex: number;
  decayRate: number;
  aiRelianceRate: number;
  hybridScore: number;
  growthDelta: number;
  /** True if the student's profile is at risk (BELOW_PROFICIENT or DECAYING). */
  isAtRisk: boolean;
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Updates a student's mastery profile for a given subject × strand.
 *
 * Creates the profile if it does not exist yet (first-attempt initialisation).
 * All derived metrics are recomputed from the inputs using pure functions.
 * Telemetry is emitted after every successful write.
 *
 * Throws if:
 *   - The StrandCatalog entry for (subject, strandKey) does not exist.
 *   - The Student record for studentId does not exist.
 *   - A DB write fails (propagated to caller).
 */
export async function updateMasteryProfile(
  input: UpdateMasteryInput
): Promise<MasteryUpdateResult> {
  const {
    studentId,
    schoolId,
    subject,
    strandKey,
    gradeBand,
    newScore,
    wasAiAssisted,
    totalAttempts,
    aiAssistedAttempts,
  } = input;

  // Normalise score window — always include the new score as the last entry
  const recentScores = input.recentScores?.length
    ? input.recentScores.slice(-SCORE_WINDOW)
    : [newScore];

  const daysBetweenScores =
    input.daysBetweenScores ?? Array(Math.max(0, recentScores.length - 1)).fill(1);

  // ── 1. Load existing profile (if any) ───────────────────────────────────────
  const existing = await prisma.studentMasteryProfile.findUnique({
    where: {
      StudentMasteryProfile_studentId_subject_strandKey_key: {
        studentId,
        subject,
        strandKey,
      },
    },
    select: {
      id: true,
      baselineScore: true,
      currentScore: true,
      proficiencyState: true,
      masteryState: true,
      aiRelianceRate: true,
      baselineConfidence: true,
      baselineCompletedAt: true,
    },
  });

  // ── 2. Derive baseline (use existing; Block 7B will set it via adaptive baseline) ──
  const baselineScore = existing?.baselineScore ?? newScore;

  // ── 3. Compute all derived metrics ──────────────────────────────────────────
  const assessmentCount = recentScores.length;

  const sustainabilityIndex = computeSustainabilityIndex(recentScores);
  const decayRate = computeDecayRate(recentScores, daysBetweenScores);
  const aiRelianceRate = computeAiRelianceRate(totalAttempts, aiAssistedAttempts);
  const growthDelta = computeGrowthDelta(baselineScore, newScore);
  const hybridScore = computeHybridScoreByGradeBand(gradeBand, newScore, growthDelta, baselineScore);
  const proficiencyState = computeProficiencyState(newScore);
  const masteryState = computeMasteryState(
    newScore,
    sustainabilityIndex,
    assessmentCount,
    decayRate,
    existing?.masteryState ?? "NOT_ASSESSED"
  );

  const isAtRisk = proficiencyState === "BELOW_PROFICIENT" || masteryState === "DECAYING";
  const prevAiRelianceRate = existing?.aiRelianceRate ?? 0;
  const decayDetected = decayRate > DECAY_ALERT_THRESHOLD;

  // ── 4. Upsert the profile ────────────────────────────────────────────────────
  const now = new Date();

  const profile = await prisma.studentMasteryProfile.upsert({
    where: {
      StudentMasteryProfile_studentId_subject_strandKey_key: {
        studentId,
        subject,
        strandKey,
      },
    },
    update: {
      currentScore: newScore,
      proficiencyState,
      masteryState,
      sustainabilityIndex,
      decayRate,
      aiRelianceRate,
      lastAssessedAt: now,
      updatedAt: now,
      // Preserve baseline fields set by Block 7B; never overwrite them here
      baselineConfidence: existing?.baselineConfidence ?? null,
      baselineCompletedAt: existing?.baselineCompletedAt ?? null,
    },
    create: {
      studentId,
      subject,
      strandKey,
      baselineScore,
      currentScore: newScore,
      proficiencyState,
      masteryState,
      sustainabilityIndex,
      decayRate,
      aiRelianceRate,
      lastAssessedAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });

  // ── 5. Emit telemetry (no PII in payloads) ──────────────────────────────────
  const telemetryScope = {
    scope: "school" as const,
    scopeId: schoolId,
    schoolId,
    pilotOnly: true,
  };

  // Always emit mastery.updated
  await recordMetricEvent(
    "mastery.updated",
    {
      subject,
      strandKey,
      gradeBand,
      proficiencyState,
      masteryState,
      hybridScore: Math.round(hybridScore * 1000) / 1000,
    },
    telemetryScope
  );

  // Conditional: at-risk alert
  if (isAtRisk) {
    await recordMetricEvent(
      "mastery.at_risk",
      { subject, strandKey, gradeBand, proficiencyState, masteryState },
      { ...telemetryScope, severity: "warning" }
    );
  }

  // Conditional: AI reliance shift (suppress noise for tiny changes)
  if (Math.abs(aiRelianceRate - prevAiRelianceRate) >= AI_RELIANCE_DELTA_THRESHOLD) {
    await recordMetricEvent(
      "ai.reliance.changed",
      {
        subject,
        strandKey,
        aiRelianceRate: Math.round(aiRelianceRate * 1000) / 1000,
        delta: Math.round((aiRelianceRate - prevAiRelianceRate) * 1000) / 1000,
      },
      telemetryScope
    );
  }

  // Conditional: decay detected
  if (decayDetected) {
    await recordMetricEvent(
      "decay.detected",
      {
        subject,
        strandKey,
        decayRate: Math.round(decayRate * 10000) / 10000,
      },
      { ...telemetryScope, severity: "warning" }
    );
  }

  return {
    profileId: profile.id,
    studentId,
    subject,
    strandKey,
    currentScore: newScore,
    proficiencyState,
    masteryState,
    sustainabilityIndex,
    decayRate,
    aiRelianceRate,
    hybridScore,
    growthDelta,
    isAtRisk,
  };
}
