/**
 * lib/reporting/monthly/aggregationService.ts — Block 8: Monthly Aggregation Service
 *
 * Queries StudentMasteryProfile for a given scope and reporting month,
 * returning the rows needed by the computation library (compute.ts).
 *
 * Scope support:
 *   "school"   — all students whose User.schoolId = scopeId
 *   "national" — all students (no school filter; caller MUST enforce platform-admin auth)
 *
 * Data window:
 *   Only profiles where lastAssessedAt ≤ last millisecond of the reporting month are
 *   included. This makes a monthly report a point-in-time snapshot: generating the
 *   report for "2026-01" in February will only include data assessed before February 1.
 *
 * Tenant safety:
 *   - School scope: filters by Student.User.schoolId (FK chain: profile → student → user → school).
 *   - National scope: no school filter; caller must verify platform-admin role.
 *   - No cross-school data is mixed in school-scoped results.
 *   - schoolId is never the sole predicate for school scope (studentId is always the PK).
 *
 * growthDelta:
 *   Not stored in StudentMasteryProfile; computed here as currentScore − baselineScore.
 */

import { prisma } from "@/lib/db";
import type { MasteryProfileRow } from "./compute";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AggregationScope = "school" | "national";

export type AggregationInput = {
  scope: AggregationScope;
  /**
   * For "school" scope: the school's DB id (schoolId).
   * For "national" scope: null.
   */
  scopeId: string | null;
  /** Reporting period in "YYYY-MM" format (e.g. "2026-01"). */
  month: string;
  /** Optional subject filter. null = all subjects included. */
  subject?: string | null;
};

export type AggregationResult = {
  rows: MasteryProfileRow[];
  /** Distinct students with at least one profile row in the result set. */
  distinctStudentCount: number;
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Fetches all StudentMasteryProfile rows for the reporting scope and month,
 * then maps them to MasteryProfileRow shape for the computation library.
 *
 * Throws on DB errors (propagated to caller).
 */
export async function aggregateProfilesForScope(
  input: AggregationInput
): Promise<AggregationResult> {
  const { scope, scopeId, month, subject } = input;

  // ── Derive month-end cutoff ────────────────────────────────────────────────
  const [yearStr, monthStr] = month.split("-");
  const monthEnd = new Date(
    Date.UTC(Number(yearStr), Number(monthStr), 0, 23, 59, 59, 999)
  );

  // ── Build Prisma where clause ──────────────────────────────────────────────
  // Using `any` cast because prisma.studentMasteryProfile is not yet in the
  // generated client (schema updated, prisma generate pending). See ADR-0009.
  const where: Record<string, unknown> = {
    lastAssessedAt: { lte: monthEnd },
  };

  if (subject && subject !== "__ALL__") {
    where.subject = subject;
  }

  if (scope === "school") {
    if (!scopeId) {
      throw Object.assign(
        new Error("scopeId is required for school scope"),
        { status: 400 }
      );
    }
    where.student = {
      user: { schoolId: scopeId },
    };
  }
  // national scope: no additional filter; caller must enforce platform-admin auth

  // ── Query ──────────────────────────────────────────────────────────────────
  const profiles = await (prisma as any).studentMasteryProfile.findMany({
    where,
    select: {
      studentId: true,
      subject: true,
      strandKey: true,
      currentScore: true,
      baselineScore: true,
      sustainabilityIndex: true,
      aiRelianceRate: true,
      proficiencyState: true,
      masteryState: true,
    },
  }) as Array<{
    studentId: string;
    subject: string;
    strandKey: string;
    currentScore: number;
    baselineScore: number;
    sustainabilityIndex: number;
    aiRelianceRate: number;
    proficiencyState: string;
    masteryState: string;
  }>;

  // ── Map to MasteryProfileRow (compute growthDelta inline) ─────────────────
  const rows: MasteryProfileRow[] = profiles.map((p) => ({
    subject: p.subject,
    strandKey: p.strandKey,
    currentScore: p.currentScore,
    baselineScore: p.baselineScore,
    growthDelta: p.currentScore - p.baselineScore,
    sustainabilityIndex: p.sustainabilityIndex,
    aiRelianceRate: p.aiRelianceRate,
    proficiencyState: p.proficiencyState,
    masteryState: p.masteryState,
  }));

  const distinctStudentCount = new Set(profiles.map((p) => p.studentId)).size;

  return { rows, distinctStudentCount };
}
