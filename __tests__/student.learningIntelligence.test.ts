import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssessmentAttemptFindMany = vi.hoisted(() => vi.fn());
const mockDerivedStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockMisconceptionTagFindMany = vi.hoisted(() => vi.fn());
const mockInterventionRecommendationFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findUnique: mockStudentFindUnique,
    },
    scheduledWork: {
      findMany: mockScheduledWorkFindMany,
    },
    studentProgress: {
      findMany: mockStudentProgressFindMany,
    },
    assessmentAttempt: {
      findMany: mockAssessmentAttemptFindMany,
    },
    derivedStudentProgress: {
      findMany: mockDerivedStudentProgressFindMany,
    },
    misconceptionTag: {
      findMany: mockMisconceptionTagFindMany,
    },
    interventionRecommendation: {
      findMany: mockInterventionRecommendationFindMany,
    },
  },
}));

describe("buildStudentLearningIntelligence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes subject mastery, weaknesses, and deterministic next actions from existing data", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "work-1",
        scheduledDate: new Date("2026-04-22T08:00:00Z"),
        periodNumber: 1,
        contentId: "content-1",
        content: {
          contentId: "content-1",
          subject: "MATH",
          payload: { title: "Fractions" },
        },
      },
      {
        id: "work-2",
        scheduledDate: new Date("2026-04-23T08:00:00Z"),
        periodNumber: 1,
        contentId: "content-2",
        content: {
          contentId: "content-2",
          subject: "MATH",
          payload: { title: "Ratios" },
        },
      },
    ]);
    mockStudentProgressFindMany.mockResolvedValue([
      {
        scheduledWorkId: "work-1",
        startedAt: new Date("2026-04-22T08:15:00Z"),
        completedAt: null,
      },
    ]);
    mockAssessmentAttemptFindMany.mockResolvedValue([
      {
        id: "attempt-1",
        subject: "MATH",
        score: 0.4,
        attemptedAt: new Date("2026-04-22T09:00:00Z"),
        submittedAt: new Date("2026-04-22T09:05:00Z"),
        metadata: { scheduledWorkId: "work-1", contentId: "content-1" },
        evaluation: {
          gapAnalysis: {
            missedConcepts: [{ concept: "equivalent_fractions" }],
          },
        },
      },
      {
        id: "attempt-2",
        subject: "MATH",
        score: 0.55,
        attemptedAt: new Date("2026-04-20T09:00:00Z"),
        submittedAt: new Date("2026-04-20T09:05:00Z"),
        metadata: { scheduledWorkId: "work-1", contentId: "content-1" },
        evaluation: {},
      },
    ]);
    mockDerivedStudentProgressFindMany.mockResolvedValue([
      {
        subject: "MATH",
        strandKey: "fractions",
        currentScore: 0.5,
        masteryState: "APPROACHING",
        derivedAt: new Date("2026-04-22T09:10:00Z"),
      },
    ]);
    mockMisconceptionTagFindMany.mockResolvedValue([]);
    mockInterventionRecommendationFindMany.mockResolvedValue([]);

    const { buildStudentLearningIntelligence } = await import(
      "@/lib/student/learningIntelligence"
    );

    const result = await buildStudentLearningIntelligence({
      id: "user-1",
      schoolId: "school-1",
    });

    expect(result.masteryBySubject[0]).toMatchObject({
      subject: "MATH",
      confidenceTier: "medium",
      completedLessons: 0,
      totalLessons: 2,
    });
    expect(result.weaknesses.map((weakness) => weakness.type)).toEqual(
      expect.arrayContaining([
        "repeated_low_performance",
        "incomplete_learning_loop",
        "concept_weakness",
      ])
    );
    expect(result.recommendedNextActions[0]).toMatchObject({
      type: "continue_current_lesson",
      href: "/student/lessons/work-1",
    });
    expect(result.recommendedNextActions.some((action) => action.type === "retry_quiz")).toBe(true);
  });
});
