/**
 * POST /api/admin/reports/monthly/generate
 *
 * Manually triggers monthly report generation for a given scope and month.
 * The operation is idempotent: re-running for the same scope × month replaces
 * the existing report (does not create a duplicate).
 *
 * Request body (JSON):
 *   {
 *     scope:    "school" | "national",
 *     scopeId:  string,        // Required for scope="school"; omit for national
 *     month:    string,        // "YYYY-MM" format, e.g. "2026-01"
 *     subject?: string         // Optional subject filter. Omit for all subjects.
 *   }
 *
 * Response (200):
 *   { reportId, status, month, scope, scopeId, headline, totalStudents, totalStrands, tierCounts }
 *   — when ENABLE_MONTHLY_REPORTS is on and generation succeeds.
 *
 *   { disabled: true }
 *   — when ENABLE_MONTHLY_REPORTS is off.
 *
 * Errors:
 *   400 — Missing/invalid fields (month format, scope value)
 *   401 — Not authenticated
 *   403 — Not ADMIN, or school-scope for a different school (non-platform admin)
 *
 * Access control:
 *   - ADMIN role required.
 *   - School scope: non-platform admins can only generate for their own school.
 *   - National scope: platform admin only.
 *
 * ⚠️  The response includes tierCounts. This is INTERNAL ONLY (see ADR-0009).
 *   Do not expose this response to students, guardians, or public dashboards.
 *
 * Tenant safety: schoolId derived from session when scope = "school" and no scopeId
 * is provided by a non-platform admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resolveScopeParams } from "@/lib/reporting/scope";
import { generateMonthlyReport } from "@/lib/reporting/monthly/reportGenerator";
import { isValidReportMonth } from "@/lib/reporting/monthly/compute";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { scope, scopeId, month, subject } = body as {
      scope?: unknown;
      scopeId?: unknown;
      month?: unknown;
      subject?: unknown;
    };

    // ── Validate month ─────────────────────────────────────────────────────
    if (!month || typeof month !== "string") {
      return NextResponse.json(
        { error: "Missing required field: month (expected \"YYYY-MM\")" },
        { status: 400 }
      );
    }
    if (!isValidReportMonth(month)) {
      return NextResponse.json(
        { error: `Invalid month "${month}". Expected YYYY-MM format (e.g. "2026-01").` },
        { status: 400 }
      );
    }

    // ── Resolve and authorise scope ───────────────────────────────────────
    const resolved = resolveScopeParams({
      scopeParam: typeof scope === "string" ? scope : null,
      scopeIdParam: typeof scopeId === "string" ? scopeId : null,
      user,
    });

    // Only "school" and "national" are supported in the aggregation service
    if (resolved.scope === "county" || resolved.scope === "district") {
      return NextResponse.json(
        { error: "County and district scope are not yet supported for monthly reports." },
        { status: 400 }
      );
    }

    // ── Generate report ───────────────────────────────────────────────────
    const result = await generateMonthlyReport({
      scope: resolved.scope as "school" | "national",
      scopeId: resolved.scopeId,
      schoolId: resolved.scope === "school" ? resolved.scopeId : null,
      month,
      subject: typeof subject === "string" ? subject : null,
      triggeredBy: user.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
