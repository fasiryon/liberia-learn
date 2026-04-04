import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      count: vi.fn(),
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
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGovAuditSearchEnabled, isGovCircuitBreakerTripped } from "@/lib/serverFlags";

function makeAdminUser(schoolId = "school-123", isPlatformAdmin = false) {
  return { id: "user-1", role: "ADMIN", schoolId, isPlatformAdmin };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/compliance/audit-log");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

const sampleEntries = [
  {
    id: "audit-1",
    createdAt: new Date("2026-02-01T10:00:00Z"),
    action: "export.training.summary",
    ipAddress: "10.0.0.1",
    userId: "user-1",
    user: { email: "admin@school.lr", role: "ADMIN" },
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
  (requireUser as any).mockResolvedValue(makeAdminUser());
  (prisma.auditLog.count as any).mockResolvedValue(1);
  (prisma.auditLog.findMany as any).mockResolvedValue(sampleEntries);
});

describe("GET /api/admin/compliance/audit-log - feature flags", () => {
  it("returns 503 when circuit breaker is tripped", async () => {
    (isGovCircuitBreakerTripped as any).mockReturnValue(true);

    const response = await GET(makeRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "governance_disabled" });
  });

  it("returns 403 when audit search is disabled", async () => {
    (isGovAuditSearchEnabled as any).mockReturnValue(false);

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "audit_search_disabled" });
  });
});

describe("GET /api/admin/compliance/audit-log - RBAC", () => {
  it("returns 403 for non-admin users", async () => {
    (requireUser as any).mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
  });

  it("returns 401 for unauthenticated requests", async () => {
    (requireUser as any).mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
  });
});

describe("GET /api/admin/compliance/audit-log - tenant isolation", () => {
  it("scopes school admins to their own school", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-abc", false));

    await GET(makeRequest());

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-abc" }),
      })
    );
  });

  it("does not let school admins override schoolId", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-abc", false));

    await GET(makeRequest({ schoolId: "school-evil" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-abc" }),
      })
    );
  });

  it("lets platform admins query across all schools by default", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-abc", true));

    await GET(makeRequest());

    const whereArg = (prisma.auditLog.findMany as any).mock.calls[0][0].where;
    expect(whereArg).not.toHaveProperty("schoolId");
  });

  it("lets platform admins filter by schoolId", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-abc", true));

    await GET(makeRequest({ schoolId: "school-target" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId: "school-target" }),
      })
    );
  });
});

describe("GET /api/admin/compliance/audit-log - filters and shape", () => {
  it("returns paginated JSON shape", async () => {
    (prisma.auditLog.count as any).mockResolvedValue(75);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 75,
      page: 1,
      pageSize: 50,
      pages: 2,
    });
  });

  it("applies actorEmail and role filters through the user relation", async () => {
    await GET(makeRequest({ actorEmail: "admin@", role: "ADMIN" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            email: { contains: "admin@", mode: "insensitive" },
            role: "ADMIN",
          },
        }),
      })
    );
  });

  it("applies case-insensitive action filters", async () => {
    await GET(makeRequest({ action: "Export" }));

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { contains: "Export", mode: "insensitive" },
        }),
      })
    );
  });

  it("returns actor identity and ipAddress in entries", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.entries[0]).toMatchObject({
      ipAddress: "10.0.0.1",
      user: { email: "admin@school.lr", role: "ADMIN" },
    });
  });
});

describe("GET /api/admin/compliance/audit-log - CSV export", () => {
  it("returns CSV with actor columns", async () => {
    const response = await GET(makeRequest({ format: "csv" }));

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("Actor Email");
    expect(csv).toContain("Actor Role");
    expect(csv).toContain("admin@school.lr");
  });
});
