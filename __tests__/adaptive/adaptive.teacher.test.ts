import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockBuildClassIntelligence,
  mockBuildTeacherClassPerformance,
  mockRequireRole,
  mockIsAdaptiveEngineEnabled,
} = vi.hoisted(() => ({
  mockBuildClassIntelligence: vi.fn(),
  mockBuildTeacherClassPerformance: vi.fn(),
  mockRequireRole: vi.fn(),
  mockIsAdaptiveEngineEnabled: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/reporting/teacherClassPerformance", () => ({
  buildTeacherClassPerformance: mockBuildTeacherClassPerformance,
}));
vi.mock("@/lib/student/adaptiveRecommendations", () => ({
  buildClassIntelligence: mockBuildClassIntelligence,
}));
vi.mock("@/lib/serverFlags", () => ({
  isAdaptiveEngineEnabled: mockIsAdaptiveEngineEnabled,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: vi.fn() },
    school: { findUnique: vi.fn() },
    scheduledWork: { findMany: vi.fn() },
    studentProgress: { count: vi.fn(), findMany: vi.fn() },
    enrollment: { count: vi.fn() },
    assignmentSubmission: { count: vi.fn() },
    labSession: { count: vi.fn() },
    curriculumContent: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/teacher/dashboard/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

function setupDefaults() {
  mockRequireRole.mockResolvedValue({ id: "teacher1", schoolId: "school1", role: "TEACHER" });
  mockIsAdaptiveEngineEnabled.mockReturnValue(false);
  mockBuildTeacherClassPerformance.mockResolvedValue([]);
  mockPrisma.class.findMany.mockResolvedValue([{ id: "class1", name: "Class 5A" }]);
  mockPrisma.school.findUnique.mockResolvedValue({ code: "SCH001", name: "Test School" });
  mockPrisma.scheduledWork.findMany.mockResolvedValue([]);
  mockPrisma.studentProgress.count.mockResolvedValue(0);
  mockPrisma.studentProgress.findMany.mockResolvedValue([]);
  mockPrisma.enrollment.count.mockResolvedValue(20);
  mockPrisma.assignmentSubmission.count.mockResolvedValue(0);
  mockPrisma.labSession.count.mockResolvedValue(0);
  mockPrisma.curriculumContent.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/teacher/dashboard — classIntelligence", () => {
  it("includes classIntelligence in response", async () => {
    setupDefaults();
    mockBuildClassIntelligence.mockResolvedValueOnce({
      atRisk: 3,
      topPerformers: 5,
      classAvgMastery: 71,
      weakLessons: [{ contentId: "c1", title: "Fractions", avgScore: 55, attemptCount: 10 }],
      interventionRecommendations: [{ studentId: "s1", type: "review", reason: "Low mastery" }],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.classIntelligence).not.toBeNull();
    expect(body.classIntelligence.atRisk).toBe(3);
    expect(body.classIntelligence.topPerformers).toBe(5);
    expect(body.classIntelligence.classAvgMastery).toBe(71);
    expect(body.classIntelligence.weakLessons).toHaveLength(1);
    expect(body.classIntelligence.weakLessons[0].title).toBe("Fractions");
    expect(body.classIntelligence.interventionRecommendations).toHaveLength(1);
  });

  it("returns null classIntelligence when buildClassIntelligence fails", async () => {
    setupDefaults();
    mockBuildClassIntelligence.mockRejectedValueOnce(new Error("DB timeout"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.classIntelligence).toBeNull();
  });
});
