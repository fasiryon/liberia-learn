/**
 * GET /api/admin/reports/monthly/[id]
 *
 * Retrieves a single monthly report by ID, including the full payloadJson
 * with per-strand breakdown and tier labels.
 *
 * Query parameters:
 *   format   "json" | "pdf"   (default: "json")
 *            PDF requires ENABLE_REPORT_PDF_EXPORT flag; returns 501 when off.
 *
 * Response (200, format=json):
 *   {
 *     id, scope, scopeId, month, subject, status,
 *     proficiencyRate, masteryRate, avgGrowthDelta,
 *     sustainabilityIndex, aiRelianceRate,
 *     totalStudents, totalStrands,
 *     tierCounts,    // INTERNAL ONLY — see ADR-0009
 *     payload: {    // Full MonthlyReportPayload
 *       meta, headline, strandBreakdown, tierSummary
 *     },
 *     generatedAt, createdAt
 *   }
 *
 * Response (200, format=pdf):
 *   501 Not Implemented (PDF export not available — see ENABLE_REPORT_PDF_EXPORT).
 *
 * Errors:
 *   400 — Invalid format
 *   401 — Not authenticated
 *   403 — Not ADMIN or report belongs to a different school
 *   404 — Report not found
 *
 * ⚠️  payload.strandBreakdown contains tier labels and tierCounts is INTERNAL ONLY
 *   (see ADR-0009). This endpoint is ADMIN-gated. Do not forward to public endpoints.
 *
 * Tenant safety:
 *   Non-platform admins can only access reports where schoolId = their own schoolId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { NATIONAL_SCOPE_ID_SENTINEL } from "@/lib/reporting/monthly/reportGenerator";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("ADMIN");
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Missing report id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (format !== "json" && format !== "pdf") {
      return NextResponse.json(
        { error: 'format must be "json" or "pdf"' },
        { status: 400 }
      );
    }

    // ── PDF stub ───────────────────────────────────────────────────────────
    if (format === "pdf") {
      if (!isFeatureEnabled("ENABLE_REPORT_PDF_EXPORT")) {
        return NextResponse.json(
          {
            error:
              "PDF export is not available in this deployment. " +
              "Install a PDF generation library and set NEXT_PUBLIC_ENABLE_REPORT_PDF_EXPORT=true.",
          },
          { status: 501 }
        );
      }
      // Future: generate and stream a PDF artifact
      return NextResponse.json(
        { error: "PDF generation not yet implemented" },
        { status: 501 }
      );
    }

    // ── Fetch report ───────────────────────────────────────────────────────
    const row = await (prisma as any).monthlyReport.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        scope: true,
        scopeId: true,
        month: true,
        subject: true,
        status: true,
        proficiencyRate: true,
        masteryRate: true,
        avgGrowthDelta: true,
        sustainabilityIndex: true,
        aiRelianceRate: true,
        totalStudents: true,
        totalStrands: true,
        tierCountsJson: true,
        payloadJson: true,
        generatedAt: true,
        createdAt: true,
      },
    }) as Record<string, unknown> | null;

    if (!row) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // ── Access control ─────────────────────────────────────────────────────
    // Non-platform admins can only access their own school's reports
    if (!user.isPlatformAdmin) {
      if (row.scope === "national") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (row.schoolId !== user.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Remap sentinel scopeId back to null
    const report = {
      ...row,
      scopeId: row.scopeId === NATIONAL_SCOPE_ID_SENTINEL ? null : row.scopeId,
      tierCounts: row.tierCountsJson ?? null,
      payload: row.payloadJson ?? null,
      tierCountsJson: undefined, // don't expose raw column name
      payloadJson: undefined,    // use `payload` instead
    };

    return NextResponse.json(report);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
