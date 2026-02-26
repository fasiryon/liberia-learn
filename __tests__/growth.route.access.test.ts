import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsLongitudinalTrackingEnabled = vi.hoisted(() => vi.fn());
const mockCaptureMonthlySnapshotsForStudents = vi.hoisted(() => vi.fn());
const mockListStudentSnapshotsForPeriod = vi.hoisted(() => vi.fn());
const mockComputeSchoolGrowthSummary = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: {
    VIEW_SCHOOL_DASHBOARD: "view:school:dashboard",
  },
  assertPermission: mockAssertPermission,
}));

vi.mock("@/lib/serverFlags", () => ({
  isLongitudinalTrackingEnabled: mockIsLongitudinalTrackingEnabled,
}));

vi.mock("@/lib/metrics/longitudinal/growthTracker", () => ({
  captureMonthlySnapshotsForStudents: mockCaptureMonthlySnapshotsForStudents,
}));

vi.mock("@/lib/metrics/longitudinal/growthRepo", () => ({
  listStudentSnapshotsForPeriod: mockListStudentSnapshotsForPeriod,
  startOfMonthUtc: (date: Date = new Date()) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)),
}));

vi.mock("@/lib/reporting/growth/growthAggregator", () => ({
  computeSchoolGrowthSummary: mockComputeSchoolGrowthSummary,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    enrollment: { findMany: mockEnrollmentFindMany },
  },
}));

import { GET as teacherGrowthGET } from "@/app/api/teacher/students/growth/route";
import { GET as adminGrowthSummaryGET } from "@/app/api/admin/dashboard/school/growth-summary/route";

function req(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLongitudinalTrackingEnabled.mockReturnValue(true);
  mockAssertPermission.mockReturnValue(undefined);
  mockCaptureMonthlySnapshotsForStudents.mockResolvedValue({ snapshotsWritten: 1, sampleSize: 1 });
  mockListStudentSnapshotsForPeriod.mockResolvedValue([
    {
      studentId: "student-1",
      subject: "MATH",
      strandKey: "number",
      score: 0.72,
      growthRate: 6,
      classification: "accelerating",
    },
  ]);
  mockComputeSchoolGrowthSummary.mockResolvedValue({
    periodStart: "2026-02-01T00:00:00.000Z",
    sampleSize: 10,
    bySubject: [],
    classificationCounts: { on_track: 7, at_risk: 2, accelerating: 1 },
  });
  mockLogAudit.mockResolvedValue(undefined);
  mockClassFindMany.mockResolvedValue([{ id: "class-1", name: "Class 1" }]);
  mockEnrollmentFindMany.mockResolvedValue([
    {
      classId: "class-1",
      Student: {
        id: "student-1",
        user: { id: "user-1", name: "Student One", email: "s1@example.com" },
      },
    },
  ]);
});

describe("growth route access", () => {
  it("teacher route returns 404 when longitudinal flag is OFF", async () => {
    mockIsLongitudinalTrackingEnabled.mockReturnValue(false);
    const res = await teacherGrowthGET(req("/api/teacher/students/growth"));
    expect(res.status).toBe(404);
  });

  it("teacher route is class-scoped to the requesting teacher", async () => {
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await teacherGrowthGET(req("/api/teacher/students/growth"));
    expect(res.status).toBe(200);
    expect(mockClassFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "school-1", teacherId: "teacher-1" },
      })
    );
  });

  it("admin route returns 404 when longitudinal flag is OFF", async () => {
    mockIsLongitudinalTrackingEnabled.mockReturnValue(false);
    const res = await adminGrowthSummaryGET(
      req("/api/admin/dashboard/school/growth-summary")
    );
    expect(res.status).toBe(404);
  });

  it("admin route denies non-platform admin cross-school requests", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await adminGrowthSummaryGET(
      req("/api/admin/dashboard/school/growth-summary", { schoolId: "school-2" })
    );

    expect(res.status).toBe(403);
    expect(mockComputeSchoolGrowthSummary).not.toHaveBeenCalled();
  });

  it("admin route returns aggregate-only payload", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await adminGrowthSummaryGET(req("/api/admin/dashboard/school/growth-summary"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sampleSize).toBe(10);
    expect(JSON.stringify(body)).not.toContain("studentId");
  });
});
