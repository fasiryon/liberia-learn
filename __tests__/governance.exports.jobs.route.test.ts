import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockIsGovExportsEnabled = vi.hoisted(() => vi.fn());
const mockIsGovCircuitBreakerTripped = vi.hoisted(() => vi.fn());
const mockCreateExportJob = vi.hoisted(() => vi.fn());
const mockListExportJobs = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/errors/apiErrorHandler", () => ({ handleApiError: mockHandleApiError }));
vi.mock("@/lib/serverFlags", () => ({
  isGovExportsEnabled: mockIsGovExportsEnabled,
  isGovCircuitBreakerTripped: mockIsGovCircuitBreakerTripped,
}));
vi.mock("@/lib/exports/exportJobService", () => ({
  createExportJob: mockCreateExportJob,
  listExportJobs: mockListExportJobs,
}));

import { GET, POST } from "@/app/api/admin/governance/exports/jobs/route";

const PLATFORM_ADMIN = { id: "admin-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null };
const SCHOOL_ADMIN = { id: "admin-2", role: "ADMIN", isPlatformAdmin: false, schoolId: "school-1" };

function makeReq(url: string, body?: unknown) {
  const req = { nextUrl: new URL(url), url } as any;
  if (body !== undefined) {
    req.json = () => Promise.resolve(body);
  }
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsGovCircuitBreakerTripped.mockReturnValue(false);
  mockIsGovExportsEnabled.mockReturnValue(true);
  mockHandleApiError.mockImplementation((err: any) =>
    Response.json({ error: "err" }, { status: err?.status ?? 500 })
  );
});

describe("GET /api/admin/governance/exports/jobs", () => {
  it("returns 503 when circuit breaker is tripped", async () => {
    mockIsGovCircuitBreakerTripped.mockReturnValue(true);
    const res = await GET(makeReq("http://localhost/api/admin/governance/exports/jobs"));
    expect(res.status).toBe(503);
  });

  it("returns 403 when exports disabled", async () => {
    mockIsGovExportsEnabled.mockReturnValue(false);
    const res = await GET(makeReq("http://localhost/api/admin/governance/exports/jobs"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for non-platform-admin", async () => {
    mockRequireUser.mockResolvedValue(SCHOOL_ADMIN);
    const res = await GET(makeReq("http://localhost/api/admin/governance/exports/jobs"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with job list for platform admin", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    mockListExportJobs.mockResolvedValue({ total: 0, page: 1, pageSize: 20, jobs: [] });
    const res = await GET(makeReq("http://localhost/api/admin/governance/exports/jobs"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
  });
});

describe("POST /api/admin/governance/exports/jobs", () => {
  it("returns 403 for non-platform-admin", async () => {
    mockRequireUser.mockResolvedValue(SCHOOL_ADMIN);
    const res = await POST(
      makeReq("http://localhost/api/admin/governance/exports/jobs", {
        exportType: "student_performance",
        scope: "school",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid exportType", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    const res = await POST(
      makeReq("http://localhost/api/admin/governance/exports/jobs", {
        exportType: "bad_type",
        scope: "school",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 for valid job creation", async () => {
    mockRequireUser.mockResolvedValue(PLATFORM_ADMIN);
    mockCreateExportJob.mockResolvedValue({
      id: "job-1",
      scope: "school",
      exportType: "student_performance",
      format: "csv",
      status: "pending",
      approvalStatus: "pending",
      requestedAt: new Date(),
      approvedAt: null,
      completedAt: null,
      downloadUrl: null,
    });
    const res = await POST(
      makeReq("http://localhost/api/admin/governance/exports/jobs", {
        exportType: "student_performance",
        scope: "school",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("job-1");
  });
});
