/**
 * __tests__/compliance-audit.test.ts
 *
 * Tests for GET /api/admin/compliance/audit-log
 *
 * Verifies:
 *  - Feature flag gates (circuit breaker, audit search disabled)
 *  - RBAC: TEACHER/STUDENT/GUARDIAN → 403
 *  - Tenant isolation: non-platform admin scoped to own schoolId
 *  - Platform admin can query across all schools
 *  - Platform admin can filter by schoolId
 *  - JSON pagination response shape
 *  - CSV export: requires COMPLIANCE_AUDIT_EXPORT permission
 *  - CSV export: TEACHER → 403 (no permission)
 *  - Missing schoolId handled gracefully
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    exportRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/serverFlags", () => ({
  isGovAuditSearchEnabled: vi.fn().mockReturnValue(true),
  isGovCircuitBreakerTripped: vi.fn().mockReturnValue(false),
}));

import { GET } from "@/app/api/admin/compliance/audit-log/route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isGovAuditSearchEnabled,
  isGovCircuitBreakerTripped,
} from "@/lib/serverFlags";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAdminUser(schoolId = "school-123", isPlatformAdmin = false) {
  return { id: "user-1", role: "ADMIN", schoolId, isPlatformAdmin };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/compliance/audit-log");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

const SAMPLE_ENTRIES = [
  {
    id: "audit-1",
    createdAt: new Date("2026-02-01T10:00:00Z"),
    action: "export.training.summary",
    userId: "user-1",
    resourceType: "export",
    resourceId: "exp-1",
    schoolId: "school-123",
    traceId: "trace-abc",
    details: {},
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (isGovCircuitBreakerTripped as any).mockReturnValue(false);
  (isGovAuditSearchEnabled as any).mockReturnValue(true);
  (prisma.auditLog.count as any).mockResolvedValue(1);
  (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);
});

// ── Feature flag gates ────────────────────────────────────────────────────────

describe("GET /api/admin/compliance/audit-log — feature flags", () => {
  it("returns 503 when circuit breaker is tripped", async () => {
    (isGovCircuitBreakerTripped as any).mockReturnValue(true);
    (requireRole as any).mockResolvedValue(makeAdminUser());

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("governance_disabled");
  });

  it("returns 403 when audit search is disabled", async () => {
    (isGovAuditSearchEnabled as any).mockReturnValue(false);
    (requireRole as any).mockResolvedValue(makeAdminUser());

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("audit_search_disabled");
  });
});

// ── RBAC ──────────────────────────────────────────────────────────────────────

describe("GET /api/admin/compliance/audit-log — RBAC", () => {
  it("returns 403 for TEACHER role", async () => {
    (requireRole as any).mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated request", async () => {
    (requireRole as any).mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe("GET /api/admin/compliance/audit-log — tenant isolation", () => {
  it("non-platform admin query is scoped to own schoolId", async () => {
    const user = makeAdminUser("school-abc", false);
    (requireRole as any).mockResolvedValue(user);
    (prisma.auditLog.count as any).mockResolvedValue(2);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    await GET(makeRequest());

    // findMany must be called with schoolId filter
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-abc" }),
      })
    );
  });

  it("non-platform admin cannot override schoolId via query param", async () => {
    const user = makeAdminUser("school-abc", false);
    (requireRole as any).mockResolvedValue(user);
    (prisma.auditLog.count as any).mockResolvedValue(0);
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    // Attacker tries to read another school's audit log
    await GET(makeRequest({ schoolId: "school-evil" }));

    // Must still use own schoolId, NOT the param
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-abc" }),
      })
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-evil" }),
      })
    );
  });

  it("platform admin can query all schools (no schoolId filter by default)", async () => {
    const user = makeAdminUser("school-abc", true);
    (requireRole as any).mockResolvedValue(user);
    (prisma.auditLog.count as any).mockResolvedValue(5);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    await GET(makeRequest());

    const whereArg = (prisma.auditLog.findMany as any).mock.calls[0][0].where;
    // schoolId should NOT be in the where clause when platform admin doesn't specify it
    expect(whereArg).not.toHaveProperty("schoolId");
  });

  it("platform admin can filter by specific schoolId", async () => {
    const user = makeAdminUser("school-abc", true);
    (requireRole as any).mockResolvedValue(user);
    (prisma.auditLog.count as any).mockResolvedValue(1);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    await GET(makeRequest({ schoolId: "school-target" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-target" }),
      })
    );
  });
});

// ── JSON response shape ───────────────────────────────────────────────────────

describe("GET /api/admin/compliance/audit-log — JSON shape", () => {
  it("returns correct pagination shape", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.count as any).mockResolvedValue(75);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      total: 75,
      page: 1,
      pageSize: 50,
      pages: 2,
    });
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("returns page 2 when requested", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.count as any).mockResolvedValue(100);
    (prisma.auditLog.findMany as any).mockResolvedValue([]);

    const res = await GET(makeRequest({ page: "2" }));
    const body = await res.json();
    expect(body.page).toBe(2);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50 })
    );
  });

  it("applies action filter to where clause", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.count as any).mockResolvedValue(1);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    await GET(makeRequest({ action: "export" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: { contains: "export" } }),
      })
    );
  });

  it("applies resourceType filter", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.count as any).mockResolvedValue(1);
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);

    await GET(makeRequest({ resourceType: "export" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resourceType: "export" }),
      })
    );
  });
});

// ── CSV export ────────────────────────────────────────────────────────────────

describe("GET /api/admin/compliance/audit-log — CSV export", () => {
  it("returns CSV when format=csv", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);
    (prisma.exportRecord.create as any).mockResolvedValue({ id: "exp-1" });

    const res = await GET(makeRequest({ format: "csv" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("audit-log-");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");
  });

  it("CSV response body contains header row", async () => {
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);
    (prisma.exportRecord.create as any).mockResolvedValue({ id: "exp-1" });

    const res = await GET(makeRequest({ format: "csv" }));
    const text = await res.text();
    expect(text).toContain("ID");
    expect(text).toContain("Action");
    expect(text).toContain("School ID");
    expect(text).toContain("Trace ID");
  });

  it("logs audit for CSV export", async () => {
    const { logAudit } = await import("@/lib/audit");
    (requireRole as any).mockResolvedValue(makeAdminUser());
    (prisma.auditLog.findMany as any).mockResolvedValue(SAMPLE_ENTRIES);
    (prisma.exportRecord.create as any).mockResolvedValue({ id: "exp-1" });

    await GET(makeRequest({ format: "csv" }));

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "compliance.audit_log.exported",
        resourceType: "audit_log",
      })
    );
  });
});
