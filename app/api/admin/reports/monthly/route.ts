/**
 * GET /api/admin/reports/monthly
 *
 * Lists monthly report summaries for a given scope.
 * Returns headline metrics for each matching report; payloadJson is excluded
 * from list results for performance (fetch individual report for full payload).
 *
 * Query parameters:
 *   scope     "school" | "national"  (default: "school")
 *   scopeId   string                 Required for scope="school"
 *   month     string                 Optional "YYYY-MM" filter
 *   limit     number                 Max records to return (default: 12, max: 60)
 *
 * Response (200):
 *   {
 *     reports: Array<{
 *       id, scope, scopeId, month, subject, status,
 *       proficiencyRate, masteryRate, avgGrowthDelta,
 *       sustainabilityIndex, aiRelianceRate,
 *       totalStudents, totalStrands,
 *       tierCounts,       // ADMIN-only; INTERNAL (see ADR-0009)
 *       generatedAt, createdAt
 *     }>
 *   }
 *
 * Errors:
 *   400 — Invalid scope or missing scopeId
 *   401 — Not authenticated
 *   403 — Not ADMIN, or cross-school access denied
 *
 * ⚠️  tierCounts is INTERNAL ONLY (see ADR-0009). Do not forward to public endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resolveScopeParams } from "@/lib/reporting/scope";
import { NATIONAL_SCOPE_ID_SENTINEL } from "@/lib/reporting/monthly/reportGenerator";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 60;

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");

    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get("scope");
    const scopeIdParam = searchParams.get("scopeId");
    const monthParam = searchParams.get("month");
    const limitParam = searchParams.get("limit");

    // ── Resolve and authorise scope ──────────────────────────────────────
    const resolved = resolveScopeParams({ scopeParam, scopeIdParam, user });

    if (resolved.scope === "county" || resolved.scope === "district") {
      return NextResponse.json(
        { error: "County and district scope are not yet supported for monthly reports." },
        { status: 400 }
      );
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    // ── Build where clause ───────────────────────────────────────────────
    const dbScopeId =
      resolved.scope === "national"
        ? NATIONAL_SCOPE_ID_SENTINEL
        : resolved.scopeId;

    const where: Record<string, unknown> = {
      scope: resolved.scope,
      scopeId: dbScopeId,
    };
    if (monthParam) {
      where.month = monthParam;
    }

    // ── Query ────────────────────────────────────────────────────────────
    const rows = await (prisma as any).monthlyReport.findMany({
      where,
      orderBy: { month: "desc" },
      take: limit,
      select: {
        id: true,
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
        generatedAt: true,
        createdAt: true,
      },
    }) as Array<Record<string, unknown>>;

    // Remap sentinel scopeId back to null for national reports
    const reports = rows.map((row) => ({
      ...row,
      scopeId:
        row.scopeId === NATIONAL_SCOPE_ID_SENTINEL ? null : row.scopeId,
      tierCounts: row.tierCountsJson ?? null,
      tierCountsJson: undefined, // don't leak raw column name
    }));

    return NextResponse.json({ reports });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
