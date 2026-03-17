/**
 * GET /api/admin/governance/exports/class-summary
 *
 * Exports class-level summary per school.
 * PII-free — aggregate counts only (no teacher/student names).
 *
 * Query params:
 *   scope    — "school" (default) | "national" (platform admin only)
 *   scopeId  — school ID
 *   format   — "csv" (default) | "json"
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import {
  isGovExportsEnabled,
  isGovNationalExportEnabled,
  isGovCircuitBreakerTripped,
} from "@/lib/serverFlags";
import { resolveScopeParams } from "@/lib/reporting/scope";
import { buildClassSummaryExport } from "@/lib/exports/governanceExport";
import { randomUUID } from "crypto";
import { uploadExport } from "@/lib/storage";

function buildExportKey(filename: string, traceId: string) {
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `governance/${datePrefix}/${traceId}/${filename}`;
}

function wantsJson(req: NextRequest) {
  return req.headers.get("accept")?.includes("application/json") ?? false;
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

    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

    const result = await buildClassSummaryExport({
      userId: user.id,
      schoolId: scope === "national" ? null : scopeId,
      format,
      traceId,
    });

    const filename = `class-summary-${new Date().toISOString().slice(0, 10)}.${format}`;
    const key = buildExportKey(filename, traceId);
    const downloadUrl = await uploadExport(
      key,
      Buffer.from(result.body, "utf-8"),
      result.contentType
    );

    if (!wantsJson(req)) {
      return NextResponse.redirect(downloadUrl, 307);
    }

    return NextResponse.json({
      downloadUrl,
      key,
      filename,
      contentType: result.contentType,
      expiresInSeconds: 900,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Export failed" },
      { status: err?.status ?? 500 }
    );
  }
}
