import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(1),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
    },
    class: {
      count: vi.fn().mockResolvedValue(0),
    },
    homework: {
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    sMSDeliveryLog: {
      count: vi.fn().mockResolvedValue(0),
    },
    exportRecord: {
      create: vi.fn().mockResolvedValue({ id: "export-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    trainingProgress: {
      count: vi.fn().mockResolvedValue(0),
    },
    metricEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/metrics/events", () => ({
  recordMetricEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/serverFlags", () => ({
  isGovExportsEnabled: vi.fn().mockReturnValue(true),
  isGovNationalExportEnabled: vi.fn().mockReturnValue(true),
  isGovStudentPiiExportEnabled: vi.fn().mockReturnValue(false),
  isGovCircuitBreakerTripped: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/storage", () => ({
  uploadExport: vi.fn().mockResolvedValue("https://signed.example/export.csv"),
  getExportSignedUrl: vi.fn(),
}));

import { GET as getStudentPerf } from "@/app/api/admin/governance/exports/student-performance/route";
import { GET as getClassSummary } from "@/app/api/admin/governance/exports/class-summary/route";
import { GET as getMonthlyReport } from "@/app/api/admin/governance/exports/monthly-report/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isGovCircuitBreakerTripped,
  isGovExportsEnabled,
  isGovNationalExportEnabled,
} from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { uploadExport } from "@/lib/storage";

function makeAdminUser(schoolId = "school-1", isPlatformAdmin = false) {
  return { id: "user-admin", role: "ADMIN", schoolId, isPlatformAdmin };
}

function makeRequest(
  path: string,
  params: Record<string, string> = {},
  accept?: string
) {
  const url = new URL(`http://localhost${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new NextRequest(url, {
    headers: accept ? { accept } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (isGovCircuitBreakerTripped as any).mockReturnValue(false);
  (isGovExportsEnabled as any).mockReturnValue(true);
  (isGovNationalExportEnabled as any).mockReturnValue(true);
  (requireUser as any).mockResolvedValue(makeAdminUser());
  (uploadExport as any).mockResolvedValue("https://signed.example/export.csv");
  (prisma.school.findMany as any).mockResolvedValue([
    { id: "school-1", name: "Test School", county: "Montserrado", district: "Greater Monrovia" },
  ]);
});

afterEach(() => {
  delete process.env.AWS_S3_EXPORTS_BUCKET;
});

describe("governance exports", () => {
  it("returns 503 when the circuit breaker is tripped", async () => {
    (isGovCircuitBreakerTripped as any).mockReturnValue(true);

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance")
    );

    expect(res.status).toBe(503);
  });

  it("returns 403 when exports are disabled", async () => {
    (isGovExportsEnabled as any).mockReturnValue(false);

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance")
    );

    expect(res.status).toBe(403);
  });

  it("blocks non-admin users", async () => {
    (requireUser as any).mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance")
    );

    expect(res.status).toBe(403);
  });

  it("blocks national scope for non-platform admins", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-1", false));

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance", {
        scope: "national",
      })
    );

    expect(res.status).toBe(403);
  });

  it("blocks national exports when the national flag is disabled", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-1", true));
    (isGovNationalExportEnabled as any).mockReturnValue(false);

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance", {
        scope: "national",
      })
    );

    expect(res.status).toBe(403);
  });

  it("uses the resolved school scope for school exports", async () => {
    (requireUser as any).mockResolvedValue(makeAdminUser("school-owned"));
    (prisma.school.findMany as any).mockResolvedValue([
      { id: "school-owned", name: "My School", county: null, district: null },
    ]);

    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance", {
        scope: "school",
        scopeId: "school-owned",
      })
    );

    expect(res.status).toBe(307);
    expect(prisma.school.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "school-owned" }),
      })
    );
  });

  it("redirects browser-style requests to the signed URL", async () => {
    const res = await getClassSummary(
      makeRequest("/api/admin/governance/exports/class-summary", {
        scope: "school",
        scopeId: "school-1",
      })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://signed.example/export.csv");
  });

  it("returns signed URL JSON for api-style requests", async () => {
    const res = await getStudentPerf(
      makeRequest(
        "/api/admin/governance/exports/student-performance",
        { scope: "school", scopeId: "school-1", format: "json" },
        "application/json"
      )
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        downloadUrl: "https://signed.example/export.csv",
        filename: expect.stringContaining("student-performance-"),
      })
    );
  });

  it("returns 400 for invalid monthly report yearMonth", async () => {
    const res = await getMonthlyReport(
      makeRequest(
        "/api/admin/governance/exports/monthly-report",
        { yearMonth: "not-a-date" },
        "application/json"
      )
    );

    expect(res.status).toBe(400);
  });

  it("records export audit metadata", async () => {
    await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance", {
        scope: "school",
        scopeId: "school-1",
      })
    );

    expect(prisma.exportRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          exportType: "student_performance",
          filters: expect.objectContaining({ piiIncluded: false }),
        }),
      })
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export.student_performance" })
    );
    expect(recordMetricEvent).toHaveBeenCalledWith(
      "gov.export.generated",
      expect.objectContaining({ exportType: "student_performance" }),
      expect.any(Object)
    );
  });
});
