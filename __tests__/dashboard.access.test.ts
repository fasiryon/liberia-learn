/**
 * __tests__/dashboard.access.test.ts
 *
 * RBAC and access-control tests for Block 9 dashboard routes:
 *   GET /api/admin/dashboard/school
 *   GET /api/admin/dashboard/national
 *
 * Strategy:
 *   - requireRole is mocked to return or throw depending on the scenario.
 *   - assertPermission from @/lib/permissions is NOT mocked — real logic tested.
 *   - computeSchoolDashboard / computeNationalDashboard are mocked (unit tested separately).
 *   - isPerformanceDashboardEnabled is mocked to control the feature flag.
 *   - logAudit is mocked to a no-op to avoid DB writes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole                = vi.hoisted(() => vi.fn());
const mockIsPerformanceDashboardEnabled = vi.hoisted(() => vi.fn());
const mockComputeSchoolDashboard     = vi.hoisted(() => vi.fn());
const mockComputeNationalDashboard   = vi.hoisted(() => vi.fn());
const mockLogAudit                   = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", () => ({
  isPerformanceDashboardEnabled: mockIsPerformanceDashboardEnabled,
}));

vi.mock("@/lib/reporting/dashboard/dashboardAggregator", () => ({
  computeSchoolDashboard:  mockComputeSchoolDashboard,
  computeNationalDashboard: mockComputeNationalDashboard,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

// ─── Import route handlers after mocks ────────────────────────────────────────

import { GET as getSchool }   from "@/app/api/admin/dashboard/school/route";
import { GET as getNational } from "@/app/api/admin/dashboard/national/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_METRICS = {
  avgMasteryScore: 0,
  avgBaselineGrowth: 0,
  tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
  totalStudents: 0,
  activeStudents: 0,
  monthlyReportCompletionRate: 0,
  evidenceSubmissionRate: 0,
  trainingAdoptionRate: 0,
};

function makeReq(url: string) {
  return new Request(url) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: feature flag ON, aggregators return empty metrics
  mockIsPerformanceDashboardEnabled.mockReturnValue(true);
  mockComputeSchoolDashboard.mockResolvedValue(EMPTY_METRICS);
  mockComputeNationalDashboard.mockResolvedValue(EMPTY_METRICS);
  mockLogAudit.mockResolvedValue(undefined);
});

// ─── Feature flag gate ────────────────────────────────────────────────────────

describe("feature flag: ENABLE_PERFORMANCE_DASHBOARD", () => {
  it("school route returns 404 when flag is OFF", async () => {
    mockIsPerformanceDashboardEnabled.mockReturnValue(false);
    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("performance_dashboard_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("national route returns 404 when flag is OFF", async () => {
    mockIsPerformanceDashboardEnabled.mockReturnValue(false);
    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("performance_dashboard_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });
});

// ─── School route: RBAC ───────────────────────────────────────────────────────

describe("GET /api/admin/dashboard/school — RBAC", () => {
  it("allows ADMIN (own school, non-platform)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe("school");
    expect(mockComputeSchoolDashboard).toHaveBeenCalledWith("school-aaa");
  });

  it("allows platform admin (any school via query param)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-platform",
      role: "ADMIN",
      schoolId: "school-platform",
      isPlatformAdmin: true,
    });

    const res = await getSchool(
      makeReq("http://localhost/api/admin/dashboard/school?schoolId=school-bbb")
    );
    expect(res.status).toBe(200);
    expect(mockComputeSchoolDashboard).toHaveBeenCalledWith("school-bbb");
  });

  it("platform admin falls back to own schoolId when no query param", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-platform",
      role: "ADMIN",
      schoolId: "school-platform",
      isPlatformAdmin: true,
    });

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(200);
    expect(mockComputeSchoolDashboard).toHaveBeenCalledWith("school-platform");
  });

  it("rejects non-platform ADMIN requesting a different school (403)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });

    const res = await getSchool(
      makeReq("http://localhost/api/admin/dashboard/school?schoolId=school-bbb")
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(mockComputeSchoolDashboard).not.toHaveBeenCalled();
  });

  it("returns 400 when user has no schoolId and no query param", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-orphan",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: false,
    });

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("no_school_context");
  });

  it("rejects TEACHER (requireRole throws 403)", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(403);
    expect(mockComputeSchoolDashboard).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests (requireRole throws 401)", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(res.status).toBe(401);
    expect(mockComputeSchoolDashboard).not.toHaveBeenCalled();
  });
});

// ─── School route: audit log ──────────────────────────────────────────────────

describe("GET /api/admin/dashboard/school — audit log", () => {
  it("writes audit log on success with correct fields", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });

    await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "dashboard.view.school",
        resourceType: "dashboard",
        schoolId: "school-aaa",
        details: { scope: "school", schoolId: "school-aaa" },
      })
    );
  });

  it("does NOT write audit log when feature flag is OFF", async () => {
    mockIsPerformanceDashboardEnabled.mockReturnValue(false);
    await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ─── National route: RBAC ─────────────────────────────────────────────────────

describe("GET /api/admin/dashboard/national — RBAC", () => {
  it("allows platform admin", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-platform",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });

    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scope).toBe("national");
    expect(mockComputeNationalDashboard).toHaveBeenCalledOnce();
  });

  it("rejects non-platform ADMIN (assertPermission denies DASHBOARD_NATIONAL_VIEW)", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });

    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    expect(res.status).toBe(403);
    expect(mockComputeNationalDashboard).not.toHaveBeenCalled();
  });

  it("rejects TEACHER (requireRole throws 403)", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    expect(res.status).toBe(403);
    expect(mockComputeNationalDashboard).not.toHaveBeenCalled();
  });

  it("rejects GUARDIAN (requireRole throws 403)", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    expect(res.status).toBe(403);
    expect(mockComputeNationalDashboard).not.toHaveBeenCalled();
  });
});

// ─── National route: audit log ────────────────────────────────────────────────

describe("GET /api/admin/dashboard/national — audit log", () => {
  it("writes audit log with schoolId=null on success", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-platform",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });

    await getNational(makeReq("http://localhost/api/admin/dashboard/national"));

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-platform",
        action: "dashboard.view.national",
        resourceType: "dashboard",
        schoolId: null,
        details: { scope: "national" },
      })
    );
  });
});

// ─── Response shape ───────────────────────────────────────────────────────────

describe("response shape", () => {
  it("school response includes generatedAt ISO timestamp", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-aaa",
      isPlatformAdmin: false,
    });

    const res = await getSchool(makeReq("http://localhost/api/admin/dashboard/school"));
    const body = await res.json();
    expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("national response includes generatedAt ISO timestamp", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-platform",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });

    const res = await getNational(makeReq("http://localhost/api/admin/dashboard/national"));
    const body = await res.json();
    expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
