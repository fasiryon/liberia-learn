import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetAdaptiveRecommendations,
  mockBuildStudentLearningIntelligence,
  mockRequireRole,
  mockGenerateStudentActions,
  mockGetActiveStudentAction,
  mockGetTimetableForStudent,
} =
  vi.hoisted(() => ({
    mockGetAdaptiveRecommendations: vi.fn(),
    mockBuildStudentLearningIntelligence: vi.fn(),
    mockRequireRole: vi.fn(),
    mockGenerateStudentActions: vi.fn(),
    mockGetActiveStudentAction: vi.fn(),
    mockGetTimetableForStudent: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/student/learningIntelligence", () => ({
  buildStudentLearningIntelligence: mockBuildStudentLearningIntelligence,
}));
vi.mock("@/lib/student/adaptiveRecommendations", () => ({
  getAdaptiveRecommendations: mockGetAdaptiveRecommendations,
}));
vi.mock("@/lib/lessons/labLinks", () => ({ getLessonLabLinks: () => [] }));
vi.mock("@/lib/intelligence/actionEngine", () => ({
  generateStudentActions: mockGenerateStudentActions,
  getActiveStudentAction: mockGetActiveStudentAction,
}));
vi.mock("@/lib/timetable/timetableService", () => ({
  getTimetableForStudent: mockGetTimetableForStudent,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    scheduledWork: { findMany: vi.fn() },
    assignment: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/student/today/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

function mockUser() {
  mockRequireRole.mockResolvedValue({ id: "user1", schoolId: "school1", role: "STUDENT" });
}

function defaultIntelligence() {
  return {
    generatedAt: new Date().toISOString(),
    masteryBySubject: [],
    weaknesses: [],
    recommendedNextActions: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildStudentLearningIntelligence.mockResolvedValue(defaultIntelligence());
  mockPrisma.student.findUnique.mockResolvedValue({
    id: "student1",
    enrollments: [{ classId: "class1" }],
  });
  mockPrisma.scheduledWork.findMany.mockResolvedValue([]);
  mockPrisma.assignment.findMany.mockResolvedValue([]);
  mockGenerateStudentActions.mockResolvedValue(null);
  mockGetActiveStudentAction.mockResolvedValue(null);
  mockGetTimetableForStudent.mockResolvedValue(null);
});

describe("GET /api/student/today — learner authority boundary", () => {
  it("uses ordinary scheduled schoolwork and excludes legacy adaptive authority", async () => {
    mockUser();
    mockGetAdaptiveRecommendations.mockResolvedValueOnce({
      recommendation: {
        type: "RETRY_ASSESSMENT",
        priority: 95,
        lessonId: "lesson1",
        scheduledWorkId: "work1",
        subject: "MATH",
        grade: 5,
        reason: "Score was 45%",
        sourceSignal: "assessment_attempt.low_score",
        masteryPercent: 45,
        confidenceTier: "medium",
      },
      masteryAlerts: [
        { concept: "MATH", subject: "MATH", score: 45, tier: "at_risk" },
      ],
      contentGap: false,
      pacingSignal: "slightly_behind",
      weakTopicSequence: [{ lessonId: "lesson1", reason: "Review fractions", priorityOrder: 1 }],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.priority).toBeNull();
    expect(body.recommendation).toBeNull();
    expect(body.masteryAlerts).toHaveLength(0);
    expect(body.contentGap).toBe(false);
    expect(body.pacingSignal).toBe("on_track");
    expect(body.weakTopicSequence).toEqual([]);
    expect(mockGetAdaptiveRecommendations).not.toHaveBeenCalled();
    expect(mockBuildStudentLearningIntelligence).not.toHaveBeenCalled();
    expect(mockGenerateStudentActions).not.toHaveBeenCalled();
  });

  it("does not restore legacy recommendations when the adaptive engine reports a gap", async () => {
    mockUser();
    mockGetAdaptiveRecommendations.mockResolvedValueOnce({
      recommendation: null,
      masteryAlerts: [],
      contentGap: false,
      pacingSignal: "on_track",
      weakTopicSequence: [],
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.priority).toBeNull();
    expect(body.recommendation).toBeNull();
    expect(body.masteryAlerts).toHaveLength(0);
    expect(body.contentGap).toBe(false);
    expect(body.heroRecommendation).toBeNull();
    expect(mockGetAdaptiveRecommendations).not.toHaveBeenCalled();
  });
});
