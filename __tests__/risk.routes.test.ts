import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockAssertPermission = vi.hoisted(() => vi.fn());
const mockIsDropoutRiskEnabled = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockComputeDropoutRisk = vi.hoisted(() => vi.fn());

const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockAttendanceFindMany = vi.hoisted(() => vi.fn());
const mockHomeworkFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentSubmissionFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockStudentMasteryFindMany = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/permissions", () => ({
  PERMISSIONS: { VIEW_SCHOOL_DASHBOARD: "view:school:dashboard" },
  assertPermission: mockAssertPermission,
}));
vi.mock("@/lib/serverFlags", () => ({
  isDropoutRiskEnabled: mockIsDropoutRiskEnabled,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/metrics/risk/dropoutRiskEngine", () => ({
  computeDropoutRisk: mockComputeDropoutRisk,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    enrollment: { findMany: mockEnrollmentFindMany },
    attendanceRecord: { findMany: mockAttendanceFindMany },
    homeworkSubmission: { findMany: mockHomeworkFindMany },
    assignmentSubmission: { findMany: mockAssignmentSubmissionFindMany },
    assignment: { findMany: mockAssignmentFindMany },
    studentMasteryProfile: { findMany: mockStudentMasteryFindMany },
    student: { findMany: mockStudentFindMany },
  },
}));

import { GET as teacherRiskGET } from "@/app/api/teacher/class/risk-summary/route";
import { GET as adminRiskGET } from "@/app/api/admin/dashboard/school/risk-summary/route";

function makeReq(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString()) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsDropoutRiskEnabled.mockReturnValue(true);
  mockAssertPermission.mockReturnValue(undefined);
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockClassFindMany.mockResolvedValue([]);
  mockEnrollmentFindMany.mockResolvedValue([]);
  mockAttendanceFindMany.mockResolvedValue([]);
  mockHomeworkFindMany.mockResolvedValue([]);
  mockAssignmentSubmissionFindMany.mockResolvedValue([]);
  mockAssignmentFindMany.mockResolvedValue([]);
  mockStudentMasteryFindMany.mockResolvedValue([]);
  mockStudentFindMany.mockResolvedValue([]);
  mockComputeDropoutRisk.mockReturnValue({
    totalRiskScore: 10,
    riskBand: "LOW",
    reasons: [],
  });
});

describe("dropout risk routes", () => {
  it("teacher cannot access a class outside their scope", async () => {
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockClassFindMany.mockResolvedValue([]);

    const res = await teacherRiskGET(
      makeReq("/api/teacher/class/risk-summary", { classId: "class-evil" })
    );

    expect(res.status).toBe(403);
    expect(mockComputeDropoutRisk).not.toHaveBeenCalled();
  });

  it("admin view aggregates by grade band", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockStudentFindMany.mockResolvedValue([
      { id: "student-1", currentGrade: 4 },
      { id: "student-2", currentGrade: 8 },
    ]);
    mockClassFindMany.mockResolvedValue([{ id: "class-1" }]);
    mockComputeDropoutRisk
      .mockReturnValueOnce({ totalRiskScore: 80, riskBand: "HIGH", reasons: [] })
      .mockReturnValueOnce({ totalRiskScore: 10, riskBand: "LOW", reasons: [] });

    const res = await adminRiskGET(makeReq("/api/admin/dashboard/school/risk-summary"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.byGradeBand.G4_6.total).toBe(1);
    expect(body.byGradeBand.G4_6.high).toBe(1);
    expect(body.byGradeBand.G7_9.total).toBe(1);
    expect(body.byGradeBand.G7_9.low).toBe(1);
  });

  it("admin response contains no student identifiers", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockStudentFindMany.mockResolvedValue([{ id: "student-1", currentGrade: 4 }]);
    mockClassFindMany.mockResolvedValue([{ id: "class-1" }]);

    const res = await adminRiskGET(makeReq("/api/admin/dashboard/school/risk-summary"));
    const body = await res.json();
    const bodyText = JSON.stringify(body);

    expect(bodyText).not.toContain("studentId");
    expect(bodyText).not.toContain("classId");
    expect(bodyText).not.toContain("name");
  });

  it("returns 404 when dropout risk flag is OFF", async () => {
    mockIsDropoutRiskEnabled.mockReturnValue(false);
    mockRequireRole.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await teacherRiskGET(makeReq("/api/teacher/class/risk-summary"));
    expect(res.status).toBe(404);
  });
});
