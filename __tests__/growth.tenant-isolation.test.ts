import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsLongitudinalTrackingEnabled = vi.hoisted(() => vi.fn());
const mockCaptureMonthlySnapshotsForStudents = vi.hoisted(() => vi.fn());
const mockListStudentSnapshotsForPeriod = vi.hoisted(() => vi.fn());
const mockComputeSchoolGrowthSummary = vi.hoisted(() => vi.fn());
const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { VIEW_SCHOOL_DASHBOARD: "view:school:dashboard" },
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
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    enrollment: { findMany: mockEnrollmentFindMany },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

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
  mockCaptureMonthlySnapshotsForStudents.mockResolvedValue({ snapshotsWritten: 2, sampleSize: 2 });
  mockListStudentSnapshotsForPeriod.mockResolvedValue([]);
  mockLogAudit.mockResolvedValue(undefined);

  mockClassFindMany.mockResolvedValue([
    { id: "class-1", name: "Class 1" },
    { id: "class-2", name: "Class 2" },
  ]);

  mockEnrollmentFindMany.mockResolvedValue([
    {
      classId: "class-1",
      Student: {
        id: "student-a",
        user: { id: "user-a", name: "A", email: "a@example.com" },
      },
    },
    {
      classId: "class-2",
      Student: {
        id: "student-b",
        user: { id: "user-b", name: "B", email: "b@example.com" },
      },
    },
  ]);

  mockComputeSchoolGrowthSummary.mockResolvedValue({
    periodStart: "2026-02-01T00:00:00.000Z",
    sampleSize: 2,
    bySubject: [
      {
        subject: "MATH",
        sampleSize: 2,
        avgScore: 0.65,
        avgGrowthRate: 3,
        classificationCounts: { on_track: 1, at_risk: 1, accelerating: 0 },
      },
    ],
    classificationCounts: { on_track: 1, at_risk: 1, accelerating: 0 },
  });
});

describe("growth tenant isolation", () => {
  it("teacher endpoint only queries snapshots for teacher-class students", async () => {
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await teacherGrowthGET(req("/api/teacher/students/growth"));
    expect(res.status).toBe(200);

    expect(mockListStudentSnapshotsForPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "school-1",
        schoolId: "school-1",
        studentIds: ["student-a", "student-b"],
      })
    );
  });

  it("platform admin can scope admin summary to another school", async () => {
    mockRequireRole.mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: true,
    });

    const res = await adminGrowthSummaryGET(
      req("/api/admin/dashboard/school/growth-summary", { schoolId: "school-2" })
    );

    expect(res.status).toBe(200);
    expect(mockComputeSchoolGrowthSummary).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "school-2", schoolId: "school-2" })
    );
  });

  it("admin summary response contains no student identifiers", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await adminGrowthSummaryGET(req("/api/admin/dashboard/school/growth-summary"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("studentId");
  });
});
