import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsTeacherIntelligenceDashboardEnabled = vi.hoisted(() => vi.fn());
const mockGetTeacherScope = vi.hoisted(() => vi.fn());
const mockGetStudentPerformanceSummary = vi.hoisted(() => vi.fn());
const mockConfusionFindMany = vi.hoisted(() => vi.fn());
const mockInterventionFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({
  isTeacherIntelligenceDashboardEnabled: mockIsTeacherIntelligenceDashboardEnabled,
}));
vi.mock("@/lib/intelligence/teacherScope", () => ({ getTeacherScope: mockGetTeacherScope }));
vi.mock("@/lib/intelligence/performanceAggregator", () => ({
  getStudentPerformanceSummary: mockGetStudentPerformanceSummary,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    confusionSignal: { findMany: mockConfusionFindMany },
    interventionRecommendation: { findMany: mockInterventionFindMany },
  },
}));

describe("teacher student intelligence page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTeacherIntelligenceDashboardEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    mockGetStudentPerformanceSummary.mockResolvedValue({
      studentId: "student-1",
      avgScore: 0.62,
      masteryLevel: "developing",
      improvementTrend: "improving",
      confusionCount: 2,
      pendingInterventions: 1,
    });
    mockConfusionFindMany.mockResolvedValue([
      {
        id: "sig-1",
        lessonId: "lesson-1",
        conceptTag: "MATH::fractions",
        confusionType: "low_score",
        severity: "high",
        detectedAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ]);
    mockInterventionFindMany.mockResolvedValue([
      {
        id: "int-1",
        recommendationType: "guardian_support",
        reason: "Guardian encouragement may help with motivation",
        confidenceScore: 0.6,
        status: "pending",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        expiresAt: null,
      },
    ]);
  });

  it("denies access outside tenant scope", async () => {
    mockGetTeacherScope.mockResolvedValue({
      studentIds: [],
      students: new Map(),
    });

    const { GET } = await import("@/app/api/teacher/intelligence/[studentId]/route");
    const response = await GET(new Request("http://localhost"), { params: { studentId: "student-9" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Student not found");
  });

  it("renders student performance summary when allowed", async () => {
    mockGetTeacherScope.mockResolvedValue({
      studentIds: ["student-1"],
      students: new Map([
        [
          "student-1",
          { id: "student-1", name: "Mariama", currentGrade: 6, className: "Grade 6A" },
        ],
      ]),
    });

    const { GET } = await import("@/app/api/teacher/intelligence/[studentId]/route");
    const response = await GET(new Request("http://localhost"), { params: { studentId: "student-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.student.name).toBe("Mariama");
    expect(body.summary.avgScore).toBe(0.62);
    expect(body.hasGuardianSupportRecommendation).toBe(true);
  });
});
