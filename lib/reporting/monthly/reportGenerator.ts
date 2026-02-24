/**
 * lib/reporting/monthly/reportGenerator.ts — Block 8: Monthly Report Generator
 *
 * Orchestrates the full monthly report generation pipeline:
 *   1. Feature flag check (ENABLE_MONTHLY_REPORTS).
 *   2. Input validation (month format, scope).
 *   3. Aggregation of StudentMasteryProfile data for the scope + month.
 *   4. Tier classification and headline metric computation (pure functions).
 *   5. Idempotent upsert to MonthlyReport (unique on scope × scopeId × month × subject).
 *   6. Telemetry events: report.generated | report.failed (no PII).
 *
 * Idempotency:
 *   Calling generateMonthlyReport() twice with identical inputs is safe.
 *   The second call updates the existing record rather than creating a duplicate.
 *   The unique constraint on (scope, scopeId, month, subject) + Prisma upsert
 *   guarantees at-most-one row per reporting period.
 *
 * Tenant safety:
 *   - schoolId is always derived from the caller (never from report content).
 *   - School-scoped queries are scoped by Student.User.schoolId.
 *   - National scope is passed through as-is; callers must verify platform-admin auth.
 *
 * ⚠️  Tier data (tierCountsJson, strand tier labels) is INTERNAL ONLY — ADR-0009.
 *   The payloadJson stored in the DB contains tier labels.
 *   Route handlers must enforce ADMIN role before returning payloadJson or tierCountsJson.
 *
 * See docs/product/MONTHLY_REPORTS.md for the full product reference.
 */

import { prisma } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { recordMetricEvent } from "@/lib/metrics/events";
import {
  aggregateByStrand,
  computeHeadlineMetrics,
  computeTierCounts,
  isValidReportMonth,
  type StrandAggregate,
  type ReportHeadlineMetrics,
  type TierCounts,
} from "./compute";
import { aggregateProfilesForScope, type AggregationScope } from "./aggregationService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GenerateReportInput = {
  scope: AggregationScope;
  /**
   * For "school" scope: the school's DB id.
   * For "national" scope: null (stored as "__NATIONAL__" in DB for unique constraint).
   */
  scopeId: string | null;
  /**
   * For "school" scope: the school's DB id (same as scopeId for school scope).
   * Used for tenant isolation in DB writes and telemetry scoping.
   */
  schoolId: string | null;
  /** Reporting period in "YYYY-MM" format. */
  month: string;
  /**
   * Subject to filter. Omit or pass null for all-subjects aggregate.
   * Stored as "__ALL__" in the DB for unique constraint compatibility.
   */
  subject?: string | null;
  /** User ID of the admin who triggered this report. Null for scheduled runs. */
  triggeredBy?: string | null;
};

/** The JSON payload stored in MonthlyReport.payloadJson. */
export type MonthlyReportPayload = {
  meta: {
    scope: string;
    scopeId: string | null;
    month: string;
    subject: string;
    generatedAt: string; // ISO 8601
    totalStudents: number;
    totalStrands: number;
  };
  headline: ReportHeadlineMetrics;
  /**
   * Per-strand breakdown including tier labels.
   * INTERNAL ONLY — see ADR-0009. Route handlers must enforce ADMIN auth.
   */
  strandBreakdown: StrandAggregate[];
  /**
   * Tier counts summary.
   * INTERNAL ONLY — see ADR-0009. Route handlers must enforce ADMIN auth.
   */
  tierSummary: TierCounts;
};

export type GenerateReportResult =
  | {
      disabled: true;
    }
  | {
      reportId: string;
      status: "completed";
      month: string;
      scope: string;
      scopeId: string | null;
      headline: ReportHeadlineMetrics;
      totalStudents: number;
      totalStrands: number;
      tierCounts: TierCounts;
    };

// ─── Sentinel value ───────────────────────────────────────────────────────────

/**
 * DB sentinel for null scopeId (national reports).
 * PostgreSQL NULL ≠ NULL in unique constraints, so we use a stable sentinel
 * to guarantee idempotency for national-scope reports.
 */
export const NATIONAL_SCOPE_ID_SENTINEL = "__NATIONAL__";

/**
 * DB sentinel for subject when all subjects are aggregated.
 */
export const ALL_SUBJECTS_SENTINEL = "__ALL__";

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates (or regenerates) a monthly performance report for the given scope.
 *
 * Returns { disabled: true } when ENABLE_MONTHLY_REPORTS is off without
 * performing any DB writes or telemetry.
 *
 * Throws on DB errors, invalid month format, or scope validation failures.
 */
export async function generateMonthlyReport(
  input: GenerateReportInput
): Promise<GenerateReportResult> {
  // ── 1. Feature flag ────────────────────────────────────────────────────────
  if (!isFeatureEnabled("ENABLE_MONTHLY_REPORTS")) {
    return { disabled: true };
  }

  // ── 2. Validate month format ───────────────────────────────────────────────
  if (!isValidReportMonth(input.month)) {
    throw Object.assign(
      new Error(`Invalid month format "${input.month}". Expected YYYY-MM (e.g. "2026-01").`),
      { status: 400 }
    );
  }

  const { scope, scopeId, schoolId, month, triggeredBy } = input;
  const subject = input.subject ?? null;

  // Sentinels for unique constraint compatibility
  const dbScopeId = scope === "national"
    ? NATIONAL_SCOPE_ID_SENTINEL
    : (scopeId ?? NATIONAL_SCOPE_ID_SENTINEL);
  const dbSubject = subject ?? ALL_SUBJECTS_SENTINEL;

  // Telemetry scope (no PII — schoolId in scope, not payload)
  const telemetryScope = {
    scope: "school" as const,
    scopeId: schoolId,
    schoolId: schoolId,
    pilotOnly: true,
  };

  const now = new Date();

  // ── 3. Mark as pending (creates or updates to pending) ───────────────────
  let reportId: string;
  try {
    const pendingRow = await (prisma as any).monthlyReport.upsert({
      where: {
        MonthlyReport_scope_scopeId_month_subject_key: {
          scope,
          scopeId: dbScopeId,
          month,
          subject: dbSubject,
        },
      },
      update: {
        status: "pending",
        errorMessage: null,
        updatedAt: now,
        generatedBy: triggeredBy ?? null,
      },
      create: {
        scope,
        scopeId: dbScopeId,
        schoolId: schoolId ?? null,
        month,
        subject: dbSubject,
        status: "pending",
        generatedBy: triggeredBy ?? null,
        updatedAt: now,
      },
      select: { id: true },
    }) as { id: string };
    reportId = pendingRow.id;
  } catch (err: any) {
    await recordMetricEvent(
      "report.failed",
      { scope, month, subject: dbSubject, phase: "init", reason: err.message },
      telemetryScope
    ).catch(() => {}); // never throw on telemetry failure
    throw err;
  }

  // ── 4. Aggregate mastery data ─────────────────────────────────────────────
  let strands: StrandAggregate[];
  let distinctStudentCount: number;

  try {
    const result = await aggregateProfilesForScope({
      scope,
      scopeId: scope === "national" ? null : scopeId,
      month,
      subject,
    });

    strands = aggregateByStrand(result.rows);
    distinctStudentCount = result.distinctStudentCount;
  } catch (err: any) {
    await (prisma as any).monthlyReport.update({
      where: { id: reportId },
      data: {
        status: "failed",
        errorMessage: err.message ?? "Aggregation failed",
        updatedAt: new Date(),
      },
    });
    await recordMetricEvent(
      "report.failed",
      { scope, month, subject: dbSubject, phase: "aggregation", reason: err.message },
      telemetryScope
    ).catch(() => {});
    throw err;
  }

  // ── 5. Compute metrics + tiers ────────────────────────────────────────────
  const headline = computeHeadlineMetrics(strands);
  const tierCounts = computeTierCounts(strands);

  const payload: MonthlyReportPayload = {
    meta: {
      scope,
      scopeId: scope === "national" ? null : scopeId,
      month,
      subject: dbSubject,
      generatedAt: now.toISOString(),
      totalStudents: distinctStudentCount,
      totalStrands: strands.length,
    },
    headline,
    strandBreakdown: strands,
    tierSummary: tierCounts,
  };

  // ── 6. Upsert completed report ────────────────────────────────────────────
  try {
    await (prisma as any).monthlyReport.update({
      where: { id: reportId },
      data: {
        status: "completed",
        proficiencyRate: headline.proficiencyRate,
        masteryRate: headline.masteryRate,
        avgGrowthDelta: headline.avgGrowthDelta,
        sustainabilityIndex: headline.sustainabilityIndex,
        aiRelianceRate: headline.aiRelianceRate,
        totalStudents: distinctStudentCount,
        totalStrands: strands.length,
        tierCountsJson: tierCounts as any,
        payloadJson: payload as any,
        generatedAt: now,
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
  } catch (err: any) {
    await (prisma as any).monthlyReport.update({
      where: { id: reportId },
      data: {
        status: "failed",
        errorMessage: err.message ?? "Persist failed",
        updatedAt: new Date(),
      },
    }).catch(() => {});
    await recordMetricEvent(
      "report.failed",
      { scope, month, subject: dbSubject, phase: "persist", reason: err.message },
      telemetryScope
    ).catch(() => {});
    throw err;
  }

  // ── 7. Telemetry ──────────────────────────────────────────────────────────
  await recordMetricEvent(
    "report.generated",
    {
      scope,
      month,
      subject: dbSubject,
      totalStudents: distinctStudentCount,
      totalStrands: strands.length,
    },
    telemetryScope
  ).catch(() => {}); // telemetry failures must never break the main flow

  return {
    reportId,
    status: "completed",
    month,
    scope,
    scopeId: scope === "national" ? null : scopeId,
    headline,
    totalStudents: distinctStudentCount,
    totalStrands: strands.length,
    tierCounts,
  };
}
