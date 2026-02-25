/**
 * GET /api/admin/compliance/audit-log
 *
 * Paginated audit log search with optional filters.
 * Tenant-isolated: non-platform-admins see only their school's records.
 *
 * Query params:
 *   action        — partial match (contains)
 *   userId        — exact match
 *   resourceType  — exact match
 *   from          — ISO date string (inclusive)
 *   to            — ISO date string (inclusive)
 *   page          — 1-indexed page number (default 1)
 *   schoolId      — platform admin only: filter to a specific school
 *   format        — "json" (default) | "csv" (triggers download, requires EXPORT permission)
 *
 * Returns JSON: { total, page, pageSize, pages, entries[] }
 * Returns CSV:  attachment with Content-Disposition header
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isGovAuditSearchEnabled, isGovCircuitBreakerTripped } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

const PAGE_SIZE = 50;
const CSV_MAX_ROWS = 5_000;

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    // ── Circuit breaker ─────────────────────────────────────────────────────
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }
    if (!isGovAuditSearchEnabled()) {
      return NextResponse.json({ error: "audit_search_disabled" }, { status: 403 });
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    const user = await requireRole("ADMIN");
    assertPermission(user, PERMISSIONS.COMPLIANCE_AUDIT_READ);

    // ── Parse params ────────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") ?? undefined;
    const filterUserId = searchParams.get("userId") ?? undefined;
    const resourceType = searchParams.get("resourceType") ?? undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const format = searchParams.get("format") ?? "json";

    // ── Tenant isolation ────────────────────────────────────────────────────
    // Non-platform-admins are always scoped to their schoolId.
    // Platform admins may pass an explicit schoolId to filter, or omit for all.
    const effectiveSchoolId = user.isPlatformAdmin
      ? (searchParams.get("schoolId") ?? undefined)
      : (user.schoolId ?? undefined);

    const where: Record<string, unknown> = {
      ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(filterUserId ? { userId: filterUserId } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...((fromParam || toParam)
        ? {
            createdAt: {
              ...(fromParam ? { gte: new Date(fromParam) } : {}),
              ...(toParam ? { lte: new Date(toParam) } : {}),
            },
          }
        : {}),
    };

    // ── CSV export ──────────────────────────────────────────────────────────
    if (format === "csv") {
      assertPermission(user, PERMISSIONS.COMPLIANCE_AUDIT_EXPORT);

      const entries = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: CSV_MAX_ROWS,
        select: {
          id: true,
          createdAt: true,
          action: true,
          userId: true,
          resourceType: true,
          resourceId: true,
          schoolId: true,
          traceId: true,
          ipAddress: true,
        },
      });

      await logAudit({
        userId: user.id,
        action: "compliance.audit_log.exported",
        resourceType: "audit_log",
        schoolId: user.schoolId,
        traceId,
        details: {
          rowCount: entries.length,
          filters: { action, userId: filterUserId, resourceType, from: fromParam, to: toParam },
        },
      });

      const esc = (s: string | null | undefined) =>
        `"${(s ?? "").replace(/"/g, '""')}"`;
      const header = [
        "ID",
        "Created At",
        "Action",
        "User ID",
        "Resource Type",
        "Resource ID",
        "School ID",
        "Trace ID",
        "IP Address",
      ].join(",");
      const lines = entries.map((e) =>
        [
          e.id,
          e.createdAt.toISOString(),
          e.action,
          e.userId,
          e.resourceType,
          e.resourceId,
          e.schoolId,
          e.traceId,
          e.ipAddress,
        ]
          .map(esc)
          .join(",")
      );
      const csv = [header, ...lines].join("\n");
      const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── JSON paginated list ─────────────────────────────────────────────────
    const [total, entries] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          action: true,
          userId: true,
          resourceType: true,
          resourceId: true,
          schoolId: true,
          traceId: true,
          details: true,
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.ceil(total / PAGE_SIZE),
      entries,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
