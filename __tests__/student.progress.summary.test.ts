import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssessmentAttemptFindMany = vi.hoisted(() => vi.fn());
const mockDerivedStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockCertificateFindMany = vi.hoisted(() => vi.fn());

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
    certificate: {
      findMany: mockCertificateFindMany,
    },
  },
}));

describe("buildStudentProgressSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates completion, assessment, derived progress, streak, and recent activity", async () => {
    mockStudentFindUnique.mockResolvedValue({
      id: "student-1",
      enrollments: [{ classId: "class-1" }],
    });
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "lesson-1",
        scheduledDate: new Date("2026-04-13T09:00:00Z"),
        content: {
          contentId: "content-1",
          subject: "SCIENCE",
          payload: { title: "Living Things" },
        },
      },
      {
        id: "lesson-2",
        scheduledDate: new Date("2026-04-14T09:00:00Z"),
        content: {
          contentId: "content-2",
          subject: "SCIENCE",
          payload: { title: "Plants" },
        },
      },
    ]);
    mockStudentProgressFindMany.mockResolvedValue([
      {
        scheduledWorkId: "lesson-1",
        completedAt: new Date("2026-04-14T10:00:00Z"),
        startedAt: new Date("2026-04-14T09:00:00Z"),
        scheduledWork: {
          content: {
            contentId: "content-1",
            subject: "SCIENCE",
            payload: { title: "Living Things" },
          },
        },
      },
    ]);
    mockAssessmentAttemptFindMany.mockResolvedValue([
      {
        id: "attempt-1",
        subject: "SCIENCE",
        score: 0.8,
        attemptedAt: new Date("2026-04-15T08:00:00Z"),
        submittedAt: new Date("2026-04-15T08:05:00Z"),
        metadata: { scheduledWorkId: "lesson-1" },
      },
    ]);
    mockDerivedStudentProgressFindMany.mockResolvedValue([
      {
        subject: "SCIENCE",
        currentScore: 0.72,
        masteryState: "APPROACHING",
        derivedAt: new Date("2026-04-15T08:06:00Z"),
      },
    ]);
    mockCertificateFindMany.mockResolvedValue([
      {
        id: "cert-1",
        type: "LESSON",
        referenceId: "lesson-1",
        awardedAt: new Date("2026-04-15T08:06:30Z"),
      },
    ]);

    const { buildStudentProgressSummary } = await import(
      "@/lib/student/progressSummary"
    );

    const summary = await buildStudentProgressSummary({
      id: "user-1",
      schoolId: "school-1",
    });

    expect(summary.totalLessonsCompleted).toBe(1);
    expect(summary.totalLessonsAssigned).toBe(2);
    expect(summary.averageQuizScorePercent).toBe(80);
    expect(summary.overallCurriculumCompletionPercent).toBe(50);
    expect(summary.subjectProgress).toEqual([
      expect.objectContaining({
        subject: "SCIENCE",
        completedLessons: 1,
        totalLessons: 2,
        completionPercent: 50,
        latestDerivedScore: 72,
        latestMasteryState: "APPROACHING",
      }),
    ]);
    expect(summary.recentActivity.slice(0, 3).map((activity) => activity.type)).toEqual([
      "certificate_awarded",
      "quiz_submitted",
      "lesson_completed",
    ]);
  });
});
