/**
 * GET /api/admin/governance/exports/monthly-report
 *
 * Exports a comprehensive monthly summary for a given year-month.
 * Covers enrollment, activity, SMS, training, exports, and audit events.
 * PII-free — aggregate counts only.
 *
 * Query params:
 *   yearMonth — "YYYY-MM" (default: current month)
 *   scope     — "school" (default) | "national" (platform admin only)
 *   scopeId   — school ID
 *   format    — "csv" (default) | "json"
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import {
  isGovExportsEnabled,
  isGovNationalExportEnabled,
  isGovCircuitBreakerTripped,
} from "@/lib/serverFlags";
import { resolveScopeParams } from "@/lib/reporting/scope";
import { buildMonthlyReportExport } from "@/lib/exports/governanceExport";
import { randomUUID } from "crypto";

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }
    if (!isGovExportsEnabled()) {
      return NextResponse.json({ error: "governance_exports_disabled" }, { status: 403 });
    }

    const user = await requireRole("ADMIN");
    assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_SCHOOL);

    const { searchParams } = new URL(req.url);
    const yearMonth = searchParams.get("yearMonth") ?? currentYearMonth();
    const formatParam = searchParams.get("format") ?? "csv";
    const format: "csv" | "json" = formatParam === "json" ? "json" : "csv";

    const { scope, scopeId } = resolveScopeParams({
      scopeParam: searchParams.get("scope"),
      scopeIdParam: searchParams.get("scopeId"),
      user,
    });

    if (scope === "national") {
      assertPermission(user, PERMISSIONS.GOVERNANCE_EXPORT_NATIONAL);
      if (!isGovNationalExportEnabled()) {
        return NextResponse.json({ error: "national_export_disabled" }, { status: 403 });
      }
    }

    const result = await buildMonthlyReportExport({
      userId: user.id,
      schoolId: scope === "national" ? null : scopeId,
      yearMonth,
      format,
      traceId,
    });

    const filename = `monthly-report-${yearMonth}.${format}`;
    return new NextResponse(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
