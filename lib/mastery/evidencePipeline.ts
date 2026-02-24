/**
 * lib/mastery/evidencePipeline.ts — Block 7C: Baseline → Mastery Evidence Pipeline
 *
 * Responsibilities:
 *   1. Accept structured evidence from any source (practice, assessment, manual).
 *   2. Derive computed values: correctness, assessmentWeight, gradeBand.
 *   3. Fan evidence out to both the adaptive baseline (Block 7B) and the mastery
 *      engine (Block 7A), each behind their own feature flags.
 *   4. Emit a single telemetry event (no PII) after successful processing.
 *   5. Return the combined result so callers can surface feedback to the client.
 *
 * Tenant safety:
 *   - schoolId is required for telemetry scoping; it is never used as the sole DB
 *     predicate for student data queries.
 *   - studentId scopes all DB writes; it is never included in telemetry payloads.
 *   - Both downstream services enforce their own isolation invariants.
 *
 * Feature flag behaviour:
 *   - ENABLE_ADAPTIVE_BASELINE — checked inside recordEvidenceAndUpdateBaseline();
 *     returns { disabled: true } when off. Pipeline returns it as-is.
 *   - ENABLE_MASTERY_ENGINE — checked here before calling updateMasteryProfile();
 *     returns { disabled: true } for the mastery portion when off.
 *   - Both flags can be toggled independently.
 *
 * Known limitation (Block 7D):
 *   - totalAttempts / aiAssistedAttempts are approximated as 1 / (0 or 1) per call.
 *     Block 7D will introduce an AttemptLog table for accurate cumulative tracking.
 *     See docs/product/EVIDENCE_PIPELINE.md for details.
 *
 * See docs/product/EVIDENCE_PIPELINE.md for the full product reference.
 */

import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { Subject, GradeBand } from "@prisma/client";
import {
  recordEvidenceAndUpdateBaseline,
  type RecordEvidenceResult,
} from "./baselineService";
import { updateMasteryProfile, type MasteryUpdateResult } from "./masteryService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvidenceInput = {
  /** School the student belongs to. For telemetry scoping — never the sole DB predicate. */
  schoolId: string;
  /** Student's DB id (Student.id — not User.id). Scopes all profile writes. */
  studentId: string;
  /** Subject this evidence is for. */
  subject: Subject;
  /** Strand key within the subject (must exist in StrandCatalog). */
  strandKey: string;
  /** Raw count of correct answers in this attempt. Must be ≥ 0. */
  correct: number;
  /** Total questions in this attempt. Must be ≥ 1. */
  total: number;
  /**
   * Item difficulty level (1 = easiest, 5 = hardest).
   * Defaults to 3 (medium) when omitted.
   */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Evidence source, used to determine assessmentWeight. */
  source: "practice" | "assessment" | "manual";
  /** True if the student used AI assistance during this attempt. Default: false. */
  wasAiAssisted?: boolean;
  /**
   * Total attempts on this strand including this one.
   * Default: 1. Block 7D will replace this with accurate cumulative counts from AttemptLog.
   */
  attemptCount?: number;
  /** Time spent on this attempt in seconds. Passed to baseline (stored for analytics). */
  timeSpentSec?: number;
  /** Timestamp of the evidence event. Unused in calculations; reserved for audit. */
  timestamp?: Date;
};

export type EvidencePipelineResult = {
  baseline: RecordEvidenceResult | { disabled: true };
  mastery: MasteryUpdateResult | { disabled: true };
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maps evidence source to the assessmentWeight used in the EMA update. */
const EVIDENCE_WEIGHTS: Record<EvidenceInput["source"], number> = {
  practice:   0.4,
  manual:     0.6,
  assessment: 1.0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives a GradeBand from a student's current grade (Int?).
 *
 * Mapping:
 *   null or 1–3  → G1_3
 *   4–6          → G4_6
 *   7–9          → G7_9
 *   10–12        → G10_12
 */
function gradeBandFromGrade(grade: number | null): GradeBand {
  if (grade === null || grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  return "G10_12";
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Processes a single piece of student evidence and fans it out to both the
 * adaptive baseline (Block 7B) and the mastery engine (Block 7A).
 *
 * Each downstream service checks its own feature flag. This function checks
 * ENABLE_MASTERY_ENGINE before calling updateMasteryProfile().
 *
 * Throws if any downstream service throws (DB errors propagate to the caller).
 */
export async function processEvidence(
  input: EvidenceInput
): Promise<EvidencePipelineResult> {
  const {
    schoolId,
    studentId,
    subject,
    strandKey,
    correct,
    total,
    difficulty = 3,
    source,
    wasAiAssisted = false,
    attemptCount = 1,
    timeSpentSec,
  } = input;

  // ── 1. Derive correctness ─────────────────────────────────────────────────
  // Guard against divide-by-zero; clamp to [0, 1]
  const correctness = total === 0
    ? 0
    : Math.max(0, Math.min(1, correct / total));

  // ── 2. Map source → assessmentWeight ──────────────────────────────────────
  const assessmentWeight = EVIDENCE_WEIGHTS[source];

  // ── 3. Update adaptive baseline (flag checked inside service) ────────────
  const baseline = await recordEvidenceAndUpdateBaseline({
    schoolId,
    studentId,
    subject,
    strandKey,
    evidence: {
      correctness,
      difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
      attemptCount,
      assessmentWeight,
      timeSpentSec,
    },
  });

  // ── 4. Update mastery profile (check flag here before any DB work) ────────
  let mastery: MasteryUpdateResult | { disabled: true };

  if (!isFeatureEnabled("ENABLE_MASTERY_ENGINE")) {
    mastery = { disabled: true };
  } else {
    // Derive gradeBand from the student's current grade
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { currentGrade: true },
    });
    const gradeBand = gradeBandFromGrade(student?.currentGrade ?? null);

    // Block 7D note: totalAttempts / aiAssistedAttempts are approximated here.
    // Each call contributes 1 attempt. Block 7D will introduce an AttemptLog
    // table for accurate cumulative counts.
    const totalAttempts = attemptCount;
    const aiAssistedAttempts = wasAiAssisted ? 1 : 0;

    mastery = await updateMasteryProfile({
      studentId,
      schoolId,
      subject,
      strandKey,
      gradeBand,
      newScore: correctness,
      wasAiAssisted,
      totalAttempts,
      aiAssistedAttempts,
    });
  }

  // ── 5. Emit telemetry (no PII — no studentId in payload) ─────────────────
  await recordMetricEvent(
    "evidence.processed",
    { subject, strandKey, source },
    {
      scope: "school" as const,
      scopeId: schoolId,
      schoolId,
      pilotOnly: true,
    }
  );

  return { baseline, mastery };
}
