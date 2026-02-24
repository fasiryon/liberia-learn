/**
 * lib/reporting/monthly/scheduler.ts — Block 8: Monthly Report Scheduler
 *
 * Scaffold for automated monthly report generation.
 *
 * ── Hooking into a cron system ────────────────────────────────────────────────
 *
 * Option 1 — Vercel Cron (recommended for this deployment):
 *   Add to vercel.json:
 *     { "crons": [{ "path": "/api/cron/monthly-reports", "schedule": "0 2 1 * *" }] }
 *   The route at app/api/cron/monthly-reports/route.ts calls runMonthlyReportJob().
 *   Protect with CRON_SECRET header check.
 *
 * Option 2 — pg-boss (Postgres-backed job queue):
 *   Register as a recurring job on startup:
 *     await boss.schedule("monthly-reports", "0 2 1 * *");
 *     boss.work("monthly-reports", () => runMonthlyReportJob(getPreviousMonth()));
 *
 * Option 3 — BullMQ:
 *   const queue = new Queue("monthly-reports");
 *   new Worker("monthly-reports", () => runMonthlyReportJob(getPreviousMonth()));
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 * runMonthlyReportJob() is safe to re-run. Each school's report is upserted
 * (not inserted), so a re-run after partial failure picks up where it left off
 * without creating duplicate records.
 *
 * ── When to run ───────────────────────────────────────────────────────────────
 * Run on the 1st of each month to generate the PREVIOUS month's report.
 * Example: run on 2026-02-01 to generate the "2026-01" report.
 * Use getPreviousMonth() from compute.ts for the correct month string.
 *
 * See docs/product/MONTHLY_REPORTS.md for full scheduler documentation.
 */

import { prisma } from "@/lib/db";
import { getPreviousMonth } from "./compute";
import { generateMonthlyReport } from "./reportGenerator";

export { getPreviousMonth };

// ─── Types ────────────────────────────────────────────────────────────────────

export type SchedulerRunResult = {
  month: string;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ schoolId: string; error: string }>;
};

// ─── Job runner ───────────────────────────────────────────────────────────────

/**
 * Generates monthly reports for all active schools for the given month.
 *
 * For each school, calls generateMonthlyReport() with scope = "school".
 * Failures for individual schools are captured and returned in `errors`
 * without aborting the remaining schools.
 *
 * @param month    Reporting period in "YYYY-MM" format. Defaults to previous month.
 * @param dryRun   If true, skips actual DB writes and returns processed count only.
 *                 Use for smoke-testing cron connectivity.
 */
export async function runMonthlyReportJob(
  month: string = getPreviousMonth(),
  dryRun: boolean = false
): Promise<SchedulerRunResult> {
  const schools = await prisma.school.findMany({
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ schoolId: string; error: string }> = [];

  for (const school of schools) {
    if (dryRun) {
      succeeded++;
      continue;
    }

    try {
      const result = await generateMonthlyReport({
        scope: "school",
        scopeId: school.id,
        schoolId: school.id,
        month,
      });

      if ("disabled" in result && result.disabled) {
        // Feature flag is off — count as succeeded (no-op is valid)
      }
      succeeded++;
    } catch (err: any) {
      failed++;
      errors.push({
        schoolId: school.id,
        error: err?.message ?? "Unknown error",
      });
    }
  }

  return {
    month,
    processed: schools.length,
    succeeded,
    failed,
    errors,
  };
}
