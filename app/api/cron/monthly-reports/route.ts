/**
 * GET /api/cron/monthly-reports
 *
 * Scheduled cron hook for automated monthly report generation.
 * Called on the 1st of each month to generate the previous month's reports
 * for all active schools.
 *
 * This endpoint is a scaffold — wire it into your cron system of choice:
 *   Vercel Cron (vercel.json):
 *     { "crons": [{ "path": "/api/cron/monthly-reports", "schedule": "0 2 1 * *" }] }
 *
 * Authentication:
 *   Requires CRON_SECRET header: "Authorization: Bearer <CRON_SECRET>".
 *   Set CRON_SECRET in your deployment environment.
 *   Returns 401 if the header is missing or incorrect.
 *   If CRON_SECRET is unset, all requests are rejected (fail-secure default).
 *
 * Query parameters:
 *   month    "YYYY-MM"   Override the target month (default: previous calendar month).
 *   dry_run  "true"      Skip DB writes; returns the school count that would be processed.
 *
 * Response (200):
 *   { month, processed, succeeded, failed, errors: [{ schoolId, error }] }
 *
 * Idempotency:
 *   Safe to re-run for the same month — each school's report is upserted (not inserted).
 *   Re-running after a partial failure processes only the remaining schools.
 *
 * See docs/product/MONTHLY_REPORTS.md for scheduler documentation.
 */

import { NextRequest, NextResponse } from "next/server";
import { runMonthlyReportJob, getPreviousMonth } from "@/lib/reporting/monthly/scheduler";
import { isValidReportMonth } from "@/lib/reporting/monthly/compute";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // ── Cron secret authentication ───────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail-secure: if CRON_SECRET is not configured, reject all requests
    return NextResponse.json(
      { error: "Cron endpoint is not configured (missing CRON_SECRET)" },
      { status: 401 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (token !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse parameters ─────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const dryRun = searchParams.get("dry_run") === "true";

  let month: string;
  if (monthParam) {
    if (!isValidReportMonth(monthParam)) {
      return NextResponse.json(
        { error: `Invalid month "${monthParam}". Expected YYYY-MM format.` },
        { status: 400 }
      );
    }
    month = monthParam;
  } else {
    month = getPreviousMonth();
  }

  // ── Run the job ──────────────────────────────────────────────────────────
  try {
    const result = await runMonthlyReportJob(month, dryRun);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
