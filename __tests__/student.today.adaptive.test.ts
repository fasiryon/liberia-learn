import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockBuildLearningIntelligence = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
  },
}));

vi.mock("@/lib/student/learningIntelligence", () => ({
  buildStudentLearningIntelligence: mockBuildLearningIntelligence,
}));

describe("student today adaptive plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "student-user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockBuildLearningIntelligence.mockResolvedValue({
      generatedAt: "2026-04-23T00:00:00.000Z",
      masteryBySubject: [],
      weaknesses: [{ label: "Ratios", severity: "high" }],
      recommendedNextActions: [
        {
          type: "review_weak_lesson",
          label: "Review Ratios",
          reason: "Recent quiz signals show ratio weakness.",
          href: "/student/lesson/math-g7-ratios",
          priority: 80,
        },
      ],
    });
  });

  it("prioritizes incomplete scheduled work over weak-area recommendations", async () => {
    const now = new Date();
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "sw-1",
        scheduledDate: now,
        periodNumber: 1,
        startTime: "09:00",
        endTime: "09:45",
        content: {
          contentId: "content-1",
          grade: 7,
          subject: "MATH",
          contentType: "lesson",
          payload: { title: "Ratios in Market Prices", durationMins: 45 },
        },
        progress: [{ startedAt: now, completedAt: null }],
      },
    ]);

    const { GET } = await import("@/app/api/student/today/route");
    const response = await GET();
    const body = await response.json();

    expect(body.adaptivePlan.smartContinueHref).toBe("/student/lessons/sw-1");
    expect(body.adaptivePlan.orderedActions[0]).toMatchObject({
      type: "continue_current_lesson",
      source: "scheduled_work",
    });
    expect(body.adaptivePlan.signals).toMatchObject({
      scheduledToday: 1,
      incompleteToday: 1,
      weaknessCount: 1,
      recommendationCount: 1,
    });
  });

  it("falls back deterministically to existing learning-intelligence recommendations", async () => {
    const now = new Date();
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "sw-1",
        scheduledDate: now,
        periodNumber: 1,
        startTime: "09:00",
        endTime: "09:45",
        content: {
          contentId: "content-1",
          grade: 7,
          subject: "MATH",
          contentType: "lesson",
          payload: { title: "Ratios in Market Prices", durationMins: 45 },
        },
        progress: [{ startedAt: now, completedAt: now }],
      },
    ]);

    const { GET } = await import("@/app/api/student/today/route");
    const response = await GET();
    const body = await response.json();

    expect(body.remainingCount).toBe(0);
    expect(body.currentItemId).toBe("sw-1");
    expect(body.adaptivePlan.smartContinueHref).toBe("/student/lesson/math-g7-ratios");
    expect(body.adaptivePlan.orderedActions[0]).toMatchObject({
      type: "review_weak_lesson",
      source: "learning_intelligence",
    });
  });
});

