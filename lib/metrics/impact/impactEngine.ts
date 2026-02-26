/**
 * lib/metrics/impact/impactEngine.ts — Block 12A: Proficiency + Growth Engine
 *
 * Computes defensible impact metrics from StudentMasteryProfile aggregates.
 *
 * Data source: StudentMasteryProfile (baselineScore, currentScore,
 * proficiencyState, masteryState, lastAssessedAt). Primary source is
 * individual mastery profiles; when Block 11 TrendSnapshot/MonthlySnapshot
 * tables exist they can replace the profile scan without changing this API.
 *
 * Design:
 *   - Aggregate-first: no raw student rows returned.
 *   - Deterministic + idempotent: same inputs always produce the same output.
 *   - Tenant-scoped: all queries are bounded by tenantId (= schoolId).
 *   - No PII: teacher signals use one-way hashed IDs, never raw teacherIds.
 *   - No ranking: teacher effect buckets are sorted but display hashed IDs only.
 *
 * See docs/product/IMPACT_ENGINE.md for full definitions.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  mean,
  computeEffectSize,
  classifyConfidence,
  isStatisticallyMeaningful,
  type ConfidenceLabel,
} from "./statRules";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImpactInput = {
  /** School ID of the requesting tenant. All queries are hard-scoped to this. */
  tenantId: string;
  /** Optional additional school filter (for platform admin multi-school views). */
  schoolId?: string | null;
  /** Optional class filter — must belong to tenantId school. */
  classId?: string | null;
  /** Inclusive period range in YYYY-MM format. */
  periodRange: { from: string; to: string };
  /** Months to use as baseline window (informational; default 2). */
  baselineWindowMonths?: number;
  /** Months to use as comparison window (informational; default 2). */
  comparisonWindowMonths?: number;
};

export type TeacherEffectBucket = {
  /** SHA-256 hash of `${tenantId}:${teacherId}` (first 16 hex chars). Never raw teacherId. */
  teacherIdHash: string;
  /** Average mastery score delta for this teacher's enrolled students. */
  delta: number;
  /** Confidence classification based on profile count. */
  confidence: ConfidenceLabel;
};

export type ImpactResult = {
  /** Fraction of profiles at PROFICIENT state (0–1). */
  proficiencyRate: number;
  /** Mean current mastery score across profiles (0–1). */
  avgMasteryScore: number;
  /** Mean(currentScore) − Mean(baselineScore) across profiles (−1 to +1). */
  masteryDelta: number;
  /** Mean per-profile growth delta: mean(currentScore − baselineScore). */
  growthDelta: number;
  /** Cohen's d between baseline and current score distributions. Null if insufficient data. */
  effectSize: number | null;
  /** Whether improvement meets all deterministic significance rules. */
  statisticallyMeaningful: boolean;
  /** Confidence classification based on sample size. */
  confidenceLabel: ConfidenceLabel;
  /** Number of mastery profiles included in the computation. */
  sampleSize: number;
  /**
   * Teacher-level effect signals. Only populated when scope is school (not class).
   * Uses hashed IDs — no raw teacherIds. Null when class-scoped or no class data.
   */
  teacherEffectSignals: TeacherEffectBucket[] | null;
};

// ─── YYYY-MM helpers ───────────────────────────────────────────────────────────

function parseMonthStart(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

function parseMonthEnd(yyyyMm: string): Date {
  const [y, m] = yyyyMm.split("-").map(Number);
  // First day of next month, minus 1ms
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - 1);
}

export function isValidPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

// ─── One-way teacher ID hashing ────────────────────────────────────────────────

function hashTeacherId(teacherId: string, tenantSalt: string): string {
  return createHash("sha256")
    .update(`${tenantSalt}:${teacherId}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── Prisma query builder ─────────────────────────────────────────────────────

function buildWhere(
  input: ImpactInput,
  periodStart: Date,
  periodEnd: Date
): Prisma.StudentMasteryProfileWhereInput {
  const periodFilter = {
    lastAssessedAt: { gte: periodStart, lte: periodEnd },
  };

  if (input.classId) {
    // Class-scoped: profiles of students enrolled in this class,
    // with the class belonging to the tenant school (cross-tenant guard).
    return {
      ...periodFilter,
      student: {
        enrollments: {
          some: {
            classId: input.classId,
            Class: { schoolId: input.tenantId },
          },
        },
      },
    };
  }

  const effectiveSchoolId = input.schoolId ?? input.tenantId;
  return {
    ...periodFilter,
    student: {
      user: { schoolId: effectiveSchoolId },
    },
  };
}

// ─── Profile type (matches Prisma select shape) ────────────────────────────────

type RawProfile = Prisma.StudentMasteryProfileGetPayload<{
  select: {
    baselineScore: true;
    currentScore: true;
    proficiencyState: true;
    masteryState: true;
    student: {
      select: {
        id: true;
        user: {
          select: {
            schoolId: true;
          };
        };
        enrollments: {
          select: {
            Class: {
              select: {
                teacherId: true;
              };
            };
          };
        };
      };
    };
  };
}>;

// ─── Teacher effect computation (pure) ────────────────────────────────────────

function computeTeacherEffectSignals(
  profiles: RawProfile[],
  tenantSalt: string
): TeacherEffectBucket[] {
  const byTeacher = new Map<string, number[]>();

  for (const p of profiles) {
    const delta = p.currentScore - p.baselineScore;
    for (const enrollment of p.student.enrollments) {
      const tid = enrollment.Class.teacherId;
      if (!tid) continue;
      const existing = byTeacher.get(tid) ?? [];
      existing.push(delta);
      byTeacher.set(tid, existing);
    }
  }

  const buckets: TeacherEffectBucket[] = [];
  for (const [tid, deltas] of byTeacher.entries()) {
    if (deltas.length < 3) continue; // Too few profiles for any signal
    buckets.push({
      teacherIdHash: hashTeacherId(tid, tenantSalt),
      delta: round4(mean(deltas)),
      confidence: classifyConfidence(deltas.length),
    });
  }

  // Sort by delta DESC (most improvement first). Hashed IDs — not a ranking.
  return buckets.sort((a, b) => b.delta - a.delta);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function emptyResult(): ImpactResult {
  return {
    proficiencyRate: 0,
    avgMasteryScore: 0,
    masteryDelta: 0,
    growthDelta: 0,
    effectSize: null,
    statisticallyMeaningful: false,
    confidenceLabel: "low",
    sampleSize: 0,
    teacherEffectSignals: null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes aggregate impact metrics for a tenant/school/class over a period.
 *
 * Deterministic: same inputs + same DB state → same output.
 * Tenant-safe: all queries are hard-scoped to tenantId.
 * PII-free: no student or teacher identifiers in the result.
 */
export async function computeImpact(input: ImpactInput): Promise<ImpactResult> {
  const periodStart = parseMonthStart(input.periodRange.from);
  const periodEnd = parseMonthEnd(input.periodRange.to);
  const where = buildWhere(input, periodStart, periodEnd);

  const profiles: RawProfile[] = await prisma.studentMasteryProfile.findMany({
    where,
    select: {
      baselineScore: true,
      currentScore: true,
      proficiencyState: true,
      masteryState: true,
      student: {
        select: {
          id: true,
          user: {
            select: {
              schoolId: true,
            },
          },
          enrollments: {
            select: {
              Class: { select: { teacherId: true } },
            },
          },
        },
      },
    },
  });

  const sampleSize = profiles.length;
  if (sampleSize === 0) return emptyResult();

  const currentScores = profiles.map((p) => p.currentScore);
  const baselineScores = profiles.map((p) => p.baselineScore);
  const deltas = profiles.map((p) => p.currentScore - p.baselineScore);

  const proficiencyRate =
    profiles.filter((p) => p.proficiencyState === "PROFICIENT").length / sampleSize;
  const avgMasteryScore = mean(currentScores);
  const avgBaselineScore = mean(baselineScores);
  const masteryDelta = avgMasteryScore - avgBaselineScore;
  const growthDelta = mean(deltas);
  const effectSize = computeEffectSize(baselineScores, currentScores);
  const growthFraction = deltas.filter((d) => d > 0).length / sampleSize;
  const confidenceLabel = classifyConfidence(sampleSize);
  const statisticallyMeaningful = isStatisticallyMeaningful({
    sampleSize,
    masteryDelta,
    effectSize,
    growthFraction,
  });

  const teacherEffectSignals =
    input.classId ? null : computeTeacherEffectSignals(profiles, input.tenantId);

  return {
    proficiencyRate: round4(proficiencyRate),
    avgMasteryScore: round4(avgMasteryScore),
    masteryDelta: round4(masteryDelta),
    growthDelta: round4(growthDelta),
    effectSize: effectSize !== null ? round4(effectSize) : null,
    statisticallyMeaningful,
    confidenceLabel,
    sampleSize,
    teacherEffectSignals,
  };
}

/**
 * National aggregate — queries ALL tenants without school filter.
 * No teacher signals returned (cross-tenant correlation is not meaningful).
 * Platform-admin only; enforced by the calling route.
 */
export async function computeNationalImpact(input: {
  periodRange: { from: string; to: string };
}): Promise<Omit<ImpactResult, "teacherEffectSignals">> {
  const periodStart = parseMonthStart(input.periodRange.from);
  const periodEnd = parseMonthEnd(input.periodRange.to);

  const profiles = await prisma.studentMasteryProfile.findMany({
    where: {
      lastAssessedAt: { gte: periodStart, lte: periodEnd },
    } as any,
    select: {
      baselineScore: true,
      currentScore: true,
      proficiencyState: true,
    },
  } as any);

  const sampleSize = (profiles as any[]).length;
  if (sampleSize === 0) {
    return { ...emptyResult(), teacherEffectSignals: undefined } as any;
  }

  const p = profiles as Array<{
    baselineScore: number;
    currentScore: number;
    proficiencyState: string;
  }>;

  const currentScores = p.map((x) => x.currentScore);
  const baselineScores = p.map((x) => x.baselineScore);
  const deltas = p.map((x) => x.currentScore - x.baselineScore);

  const proficiencyRate =
    p.filter((x) => x.proficiencyState === "PROFICIENT").length / sampleSize;
  const avgMasteryScore = mean(currentScores);
  const avgBaselineScore = mean(baselineScores);
  const masteryDelta = avgMasteryScore - avgBaselineScore;
  const growthDelta = mean(deltas);
  const effectSize = computeEffectSize(baselineScores, currentScores);
  const growthFraction = deltas.filter((d) => d > 0).length / sampleSize;

  return {
    proficiencyRate: round4(proficiencyRate),
    avgMasteryScore: round4(avgMasteryScore),
    masteryDelta: round4(masteryDelta),
    growthDelta: round4(growthDelta),
    effectSize: effectSize !== null ? round4(effectSize) : null,
    statisticallyMeaningful: isStatisticallyMeaningful({
      sampleSize,
      masteryDelta,
      effectSize,
      growthFraction,
    }),
    confidenceLabel: classifyConfidence(sampleSize),
    sampleSize,
  };
}
