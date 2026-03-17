import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockClient } from "aws-sdk-client-mock";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const getSignedUrlMock = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findMany: vi.fn().mockResolvedValue([
        { id: "school-1", name: "Test School", county: "Montserrado", district: "Greater Monrovia" },
      ]),
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

import { GET as getStudentPerf } from "@/app/api/admin/governance/exports/student-performance/route";
import { GET as getMonthlyReport } from "@/app/api/admin/governance/exports/monthly-report/route";
import { requireUser } from "@/lib/auth";

const s3Mock = mockClient(S3Client);

function makeRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, {
    headers: {
      accept: "application/json",
    },
  });
}

describe("governance export routes with S3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3Mock.reset();
    s3Mock.on(PutObjectCommand).resolves({});
    getSignedUrlMock.mockResolvedValue("https://signed.example/export");
    process.env.AWS_S3_EXPORTS_BUCKET = "liberialearn-exports-test";
    process.env.AWS_REGION = "us-east-1";
    (requireUser as any).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
  });

  it("returns a signed URL for student performance exports", async () => {
    const res = await getStudentPerf(
      makeRequest("/api/admin/governance/exports/student-performance", {
        scope: "school",
        scopeId: "school-1",
        format: "csv",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        downloadUrl: "https://signed.example/export",
      })
    );
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });

  it("returns a signed URL for monthly report exports", async () => {
    const res = await getMonthlyReport(
      makeRequest("/api/admin/governance/exports/monthly-report", {
        scope: "school",
        scopeId: "school-1",
        yearMonth: "2026-02",
        format: "json",
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        downloadUrl: "https://signed.example/export",
      })
    );
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });
});
