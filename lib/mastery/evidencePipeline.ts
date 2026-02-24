/**
 * lib/mastery/evidencePipeline.ts — Block 7C/8A: Baseline → Mastery Evidence Pipeline
 *
 * Responsibilities:
 *   1. Accept structured evidence from any source (practice, assessment, manual).
 *   2. Derive computed values: correctness, assessmentWeight, gradeBand.
 *   3. Insert an AttemptLog row (idempotent via unique idempotencyKey constraint).
 *   4. Fan evidence out to both the adaptive baseline (Block 7B) and the mastery
 *      engine (Block 7A), each behind their own feature flags.
 *   5. Emit a single telemetry event (no PII) after successful processing.
 *   6. Return the combined result so callers can surface feedback to the client.
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
 *   - AttemptLog creation is unconditional — it runs before any flag checks.
 *
 * AttemptLog (Block 8A):
 *   - totalAttempts / aiAssistedAttempts are now computed from AttemptLog via COUNT(*).
 *   - The Block 7C approximation (totalAttempts=1 per call) has been removed.
 *   - Block 10 optimization path: replace COUNT(*) with a counter column.
 *
 * See docs/product/EVIDENCE_PIPELINE.md and docs/product/OFFLINE_EVIDENCE.md.
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
   * @deprecated Ignored in Block 8A — cumulative count is derived from AttemptLog.
   */
  attemptCount?: number;
  /** Time spent on this attempt in seconds. Passed to baseline (stored for analytics). */
  timeSpentSec?: number;
  /** Timestamp of the evidence event. Stored in AttemptLog. */
  timestamp?: Date;
  /**
   * Client-assigned UUID for offline replay idempotency.
   * Server generates a UUID when omitted.
   */
  idempotencyKey?: string;
};

export type EvidencePipelineResult = {
  baseline: RecordEvidenceResult | { disabled: true };
  mastery: MasteryUpdateResult | { disabled: true };
  /** Present when a duplicate idempotencyKey was detected — downstream services were skipped. */
  idempotent?: true;
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
    timeSpentSec,
  } = input;

  // ── 1. Derive correctness ─────────────────────────────────────────────────
  // Guard against divide-by-zero; clamp to [0, 1]
  const correctness = total === 0
    ? 0
    : Math.max(0, Math.min(1, correct / total));

  // ── 1.5. Insert AttemptLog (unconditional — before any flag checks) ───────
  const logKey = input.idempotencyKey
    ?? (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);

  let isNewAttempt = true;
  try {
    await (prisma as any).attemptLog.create({
      data: {
        studentId,
        subject,
        strandKey,
        correct,
        total,
        source,
        difficulty: difficulty ?? null,
        wasAiAssisted,
        timestamp: input.timestamp ?? new Date(),
        idempotencyKey: logKey,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      isNewAttempt = false;
    } else {
      throw e;
    }
  }

  if (!isNewAttempt) {
    return { baseline: { disabled: true }, mastery: { disabled: true }, idempotent: true };
  }

  // ── 2. Map source → assessmentWeight ──────────────────────────────────────
  const assessmentWeight = EVIDENCE_WEIGHTS[source];

  // ── 2.5. Compute cumulative counts from AttemptLog ────────────────────────
  const [totalAttempts, aiAssistedAttempts] = await Promise.all([
    (prisma as any).attemptLog.count({ where: { studentId, subject, strandKey } }),
    (prisma as any).attemptLog.count({ where: { studentId, subject, strandKey, wasAiAssisted: true } }),
  ]);

  // ── 3. Update adaptive baseline (flag checked inside service) ────────────
  const baseline = await recordEvidenceAndUpdateBaseline({
    schoolId,
    studentId,
    subject,
    strandKey,
    evidence: {
      correctness,
      difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
      attemptCount: totalAttempts,
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
