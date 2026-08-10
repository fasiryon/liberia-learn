import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsMoePortalEnabled = vi.hoisted(() => vi.fn());
const mockGetSchoolExportMetrics = vi.hoisted(() => vi.fn());
const mockLogStudentCohortExport = vi.hoisted(() => vi.fn());
const mockLogDataAccess = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressCount = vi.hoisted(() => vi.fn());
const mockSchoolCount = vi.hoisted(() => vi.fn());
const mockStudentCount = vi.hoisted(() => vi.fn());
const mockAuditLogFindMany = vi.hoisted(() => vi.fn());
const mockExamAttemptFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressTotalCount = vi.hoisted(() => vi.fn());
const mockInterventionRecommendationCount = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/serverFlags", () => ({
  isMoePortalEnabled: mockIsMoePortalEnabled,
}));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({
  logDataAccess: mockLogDataAccess,
}));

vi.mock("@/lib/moe/exportUtils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/moe/exportUtils")>(
    "@/lib/moe/exportUtils"
  );
  return {
    ...actual,
    getSchoolExportMetrics: mockGetSchoolExportMetrics,
    logStudentCohortExport: mockLogStudentCohortExport,
    requireMoeExportUser: vi.fn(async () => {
      const user = await mockRequireUser();
      if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }
      return user;
    }),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findMany: mockStudentFindMany, count: mockStudentCount },
    studentGuardian: { findMany: mockStudentGuardianFindMany },
    studentProgress: { count: mockStudentProgressCount },
    school: { count: mockSchoolCount, findMany: mockSchoolFindMany },
    auditLog: { findMany: mockAuditLogFindMany },
    examAttempt: { findMany: mockExamAttemptFindMany },
    interventionRecommendation: { count: mockInterventionRecommendationCount },
  },
}));

describe("MOE export routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMoePortalEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({
      id: "moe-1",
      role: "MOE_OFFICIAL",
      isPlatformAdmin: false,
    });
    mockGetSchoolExportMetrics.mockResolvedValue([
      {
        schoolId: "school-1",
        schoolName: "Capitol Hill Academy",
        county: "Montserrado",
        district: "Greater Monrovia",
        totalStudents: 100,
        activeStudents: 80,
        avgLessonCompletionPct: 72.5,
        avgExamScore: 68.2,
        placementTestsCompleted: 44,
        interventionRatePct: 12.3,
        guardianEngagementPct: 61.5,
      },
    ]);
    mockStudentFindMany.mockResolvedValue([
      {
        id: "student-1",
        userId: "user-1",
        user: { schoolId: "school-1" },
        currentGrade: 6,
        placementTests: [{ band: "G4_6" }],
        examAttempts: [{ score: 0.8 }],
        assignmentSubmissions: [{ id: "sub-1" }],
        attendance: [{ status: "PRESENT" }, { status: "ABSENT" }],
        interventionRecommendations: [{ id: "ir-1" }],
      },
    ]);
    mockStudentGuardianFindMany.mockResolvedValue([
      {
        studentId: "student-1",
        student: {
          user: {
            schoolId: "school-1",
          },
        },
      },
    ]);
    mockStudentProgressCount.mockResolvedValue(3);
    mockSchoolCount.mockResolvedValue(12);
    mockStudentCount.mockResolvedValue(800);
    mockAuditLogFindMany.mockResolvedValue([{ userId: "student-user-1" }]);
    mockExamAttemptFindMany.mockResolvedValue([{ score: 0.75 }, { score: 0.5 }]);
    mockStudentProgressTotalCount.mockResolvedValue(300);
    mockInterventionRecommendationCount.mockResolvedValue(33);
    mockSchoolFindMany.mockResolvedValue([
      {
        id: "school-1",
        district: "Montserrado",
      },
    ]);
    mockLogDataAccess.mockResolvedValue(undefined);
  });

  it("returns national CSV", async () => {
    const { GET } = await import("@/app/api/moe/export/national/route");
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain(
      "liberialearn-national-export-"
    );
    expect(body).toContain("School Name");
    expect(body).toContain("Capitol Hill Academy");
    expect(body).not.toContain("student-1");
    expect(mockLogDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "moe_export", resourceId: "national", scope: "national" })
    );
  });

  it("returns district CSV", async () => {
    const { GET } = await import("@/app/api/moe/export/district/[district]/route");
    const response = await GET(new Request("http://localhost"), {
      params: { district: "Montserrado" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mockGetSchoolExportMetrics).toHaveBeenCalledWith("Montserrado");
    expect(body).toContain("Capitol Hill Academy");
    expect(mockLogDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "moe_export", resourceId: "Montserrado", scope: "district" })
    );
  });

  it("returns per-student school cohort CSV for cohorts of 5 or more, and logs audit access", async () => {
    mockStudentFindMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `student-${i + 1}`,
        userId: `user-${i + 1}`,
        user: { schoolId: "school-1" },
        currentGrade: 6,
        placementTests: [{ band: "G4_6" }],
        examAttempts: [{ score: 0.8 }],
        assignmentSubmissions: [{ id: `sub-${i + 1}` }],
        attendance: [{ status: "PRESENT" }, { status: "ABSENT" }],
        interventionRecommendations: [{ id: `ir-${i + 1}` }],
      }))
    );

    const { GET } = await import("@/app/api/moe/export/school/[schoolId]/route");
    const response = await GET(new Request("http://localhost"), {
      params: { schoolId: "school-1" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(mockLogStudentCohortExport).toHaveBeenCalledWith({
      userId: "moe-1",
      schoolId: "school-1",
    });
    expect(mockLogDataAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "moe-1", schoolId: "school-1", scope: "school" })
    );
    expect(body).toContain("Student ID");
    expect(body).not.toContain("student-1");
    expect(body).not.toContain("user-1");
    expect(body).toContain("G4_6");
  });

  it("suppresses per-student rows and returns an aggregate summary for cohorts smaller than MIN_COHORT_SIZE", async () => {
    mockStudentFindMany.mockResolvedValue([
      {
        id: "student-1",
        userId: "user-1",
        user: { schoolId: "school-1" },
        currentGrade: 6,
        placementTests: [{ band: "G4_6" }],
        examAttempts: [{ score: 0.8 }],
        assignmentSubmissions: [{ id: "sub-1" }],
        attendance: [{ status: "PRESENT" }, { status: "ABSENT" }],
        interventionRecommendations: [{ id: "ir-1" }],
      },
    ]);

    const { GET } = await import("@/app/api/moe/export/school/[schoolId]/route");
    const response = await GET(new Request("http://localhost"), {
      params: { schoolId: "school-1" },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Cohort Size");
    expect(body).not.toContain("Student ID");
    expect(body).not.toContain("G4_6");
    expect(body).not.toContain("student-1");
  });

  it("blocks exports for non-MOE, non-platform users", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "teacher-1",
      role: "TEACHER",
      isPlatformAdmin: false,
    });
    const { GET } = await import("@/app/api/moe/export/national/route");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns printable summary HTML", async () => {
    const { GET } = await import("@/app/api/moe/export/summary-pdf/route");
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("National Education Platform Summary Report");
    expect(body).toContain("window.print()");
  });
});
