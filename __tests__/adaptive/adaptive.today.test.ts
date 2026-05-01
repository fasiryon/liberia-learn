import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAdaptiveRecommendations, mockBuildStudentLearningIntelligence, mockRequireRole } =
  vi.hoisted(() => ({
    mockGetAdaptiveRecommendations: vi.fn(),
    mockBuildStudentLearningIntelligence: vi.fn(),
    mockRequireRole: vi.fn(),
  }));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/student/learningIntelligence", () => ({
  buildStudentLearningIntelligence: mockBuildStudentLearningIntelligence,
}));
vi.mock("@/lib/student/adaptiveRecommendations", () => ({
  getAdaptiveRecommendations: mockGetAdaptiveRecommendations,
}));
vi.mock("@/lib/lessons/labLinks", () => ({ getLessonLabLinks: () => [] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    scheduledWork: { findMany: vi.fn() },
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
});

describe("GET /api/student/today — adaptive fields", () => {
  it("includes priority, recommendation and masteryAlerts in response", async () => {
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

    expect(body.priority).toBe("RETRY_ASSESSMENT");
    expect(body.recommendation).not.toBeNull();
    expect(body.recommendation.type).toBe("RETRY_ASSESSMENT");
    expect(body.recommendation.masteryPercent).toBe(45);
    expect(body.recommendation.sourceSignal).toBe("assessment_attempt.low_score");
    expect(body.masteryAlerts).toHaveLength(1);
    expect(body.masteryAlerts[0].tier).toBe("at_risk");
    expect(body.contentGap).toBe(false);
    expect(body.pacingSignal).toBe("slightly_behind");
    expect(body.weakTopicSequence).toEqual([{ lessonId: "lesson1", reason: "Review fractions", priorityOrder: 1 }]);
  });

  it("returns null priority and recommendation when no signals", async () => {
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

    expect(body.priority).toBeNull();
    expect(body.recommendation).toBeNull();
    expect(body.masteryAlerts).toHaveLength(0);
    expect(body.pacingSignal).toBe("on_track");
    expect(body.weakTopicSequence).toHaveLength(0);
  });

  it("returns contentGap=true for grade 9 student", async () => {
    mockUser();
    mockGetAdaptiveRecommendations.mockResolvedValueOnce({
      recommendation: null,
      masteryAlerts: [],
      contentGap: true,
      pacingSignal: "on_track",
      weakTopicSequence: [],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.contentGap).toBe(true);
  });

  it("survives adaptive engine failure gracefully", async () => {
    mockUser();
    mockGetAdaptiveRecommendations.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.priority).toBeNull();
    expect(body.recommendation).toBeNull();
    expect(body.masteryAlerts).toHaveLength(0);
  });
});
