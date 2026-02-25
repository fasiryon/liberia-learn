/**
 * GET /api/admin/governance/exports/student-performance
 *
 * Exports aggregate student performance data per school.
 * PII-free by default — only counts and rates.
 *
 * Query params:
 *   scope    — "school" (default) | "national" (platform admin only)
 *   scopeId  — required for scope=school if not inferrable from user
 *   format   — "csv" (default) | "json"
 *
 * Access: ADMIN (school scope), Platform Admin (national scope)
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
import { buildStudentPerformanceExport } from "@/lib/exports/governanceExport";
import { randomUUID } from "crypto";

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

    const result = await buildStudentPerformanceExport({
      userId: user.id,
      schoolId: scope === "national" ? null : scopeId,
      format,
      traceId,
    });

    const filename = `student-performance-${new Date().toISOString().slice(0, 10)}.${format}`;
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
