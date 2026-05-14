import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    assessmentAttempt: { findMany: vi.fn() },
    masterySnapshot: { findMany: vi.fn() },
    derivedStudentProgress: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    scheduledWork: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    studentProgress: { findMany: vi.fn() },
    interventionRecommendation: { findMany: vi.fn() },
    curriculumContent: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}));

import { getAdaptiveRecommendations, buildClassIntelligence, buildMoeCurriculumIntelligence } from "@/lib/student/adaptiveRecommendations";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

function mockStudent(classIds: string[] = ["class1"]) {
  mockPrisma.student.findUnique.mockResolvedValueOnce({
    id: "student1",
    enrollments: classIds.map((id) => ({ classId: id })),
  });
}

function mockAttempts(attempts: Array<{ score: number; subject: string; grade?: number }>) {
  mockPrisma.assessmentAttempt.findMany.mockResolvedValueOnce(
    attempts.map((a, i) => ({
      id: `attempt${i}`,
      subject: a.subject,
      grade: a.grade ?? 5,
      score: a.score,
      attemptedAt: new Date(Date.now() - i * 86400000),
      submittedAt: new Date(Date.now() - i * 86400000),
      metadata: {},
    }))
  );
}

function mockScheduledWork(items: Array<{ subject: string; started?: boolean; completed?: boolean; daysAgo?: number }>) {
  mockPrisma.scheduledWork.findMany.mockResolvedValueOnce(
    items.map((item, i) => ({
      id: `work${i}`,
      scheduledDate: new Date(Date.now() - (item.daysAgo ?? 0) * 86400000),
      content: { contentId: `content${i}`, subject: item.subject, grade: 5 },
      progress: item.started || item.completed
        ? [{
            startedAt: item.started ? new Date() : null,
            completedAt: item.completed ? new Date() : null,
          }]
        : [],
    }))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.masterySnapshot.findMany.mockResolvedValue([]);
  mockPrisma.derivedStudentProgress.findMany.mockResolvedValue([]);
  mockPrisma.scheduledWork.findMany.mockResolvedValue([]);
  mockPrisma.curriculumContent.findMany.mockResolvedValue([]);
});

describe("getAdaptiveRecommendations — mastery scoring", () => {
  it("returns RETRY_ASSESSMENT when latest score is below 0.60", async () => {
    mockStudent();
    mockAttempts([{ score: 0.45, subject: "MATH" }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("RETRY_ASSESSMENT");
    expect(result.recommendation?.priority).toBe(95);
    expect(result.recommendation?.masteryPercent).toBe(45);
  });

  it("returns REVISIT_PREREQUISITE when 3+ attempts all below 0.65", async () => {
    mockStudent();
    mockAttempts([
      { score: 0.55, subject: "SCIENCE" },
      { score: 0.48, subject: "SCIENCE" },
      { score: 0.52, subject: "SCIENCE" },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("REVISIT_PREREQUISITE");
    expect(result.recommendation?.subject).toBe("SCIENCE");
  });

  it("returns REVIEW when score is between 0.60 and 0.75", async () => {
    mockStudent();
    mockAttempts([{ score: 0.68, subject: "LITERACY" }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("REVIEW");
    expect(result.recommendation?.masteryPercent).toBe(68);
  });

  it("returns REVIEW for stale incomplete lesson (started > 2 days ago)", async () => {
    mockStudent();
    mockAttempts([]); // no quiz attempts
    mockScheduledWork([{ subject: "CIVICS", started: true, completed: false, daysAgo: 5 }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("REVIEW");
    expect(result.recommendation?.sourceSignal).toBe("student_progress.stale_incomplete");
  });

  it("returns ADVANCE when score >= 0.80 and next lesson exists", async () => {
    mockStudent();
    mockAttempts([{ score: 0.85, subject: "MATH" }]);
    mockScheduledWork([{ subject: "MATH", started: false, completed: false }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("ADVANCE");
    expect(result.recommendation?.priority).toBe(50);
  });

  it("returns null recommendation when student has no data", async () => {
    mockPrisma.student.findUnique.mockResolvedValueOnce(null);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation).toBeNull();
    expect(result.masteryAlerts).toHaveLength(0);
  });

  it("prioritises RETRY_ASSESSMENT over REVIEW when both apply", async () => {
    mockStudent();
    // One low-score subject (RETRY) and one mid-score subject (REVIEW)
    mockPrisma.assessmentAttempt.findMany.mockResolvedValueOnce([
      { id: "a1", subject: "MATH", grade: 5, score: 0.45, attemptedAt: new Date(), submittedAt: new Date(), metadata: {} },
      { id: "a2", subject: "SCIENCE", grade: 5, score: 0.68, attemptedAt: new Date(), submittedAt: new Date(), metadata: {} },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation?.type).toBe("RETRY_ASSESSMENT");
    expect(result.recommendation?.subject).toBe("MATH");
  });

  it("generates mastery alerts for subjects below 75%", async () => {
    mockStudent();
    mockAttempts([
      { score: 0.30, subject: "MATH" },
      { score: 0.58, subject: "SCIENCE" },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.masteryAlerts.length).toBeGreaterThan(0);
    const mathAlert = result.masteryAlerts.find((a) => a.concept === "MATH");
    expect(mathAlert?.tier).toBe("critical");
    const sciAlert = result.masteryAlerts.find((a) => a.concept === "SCIENCE");
    expect(sciAlert?.tier).toBe("at_risk");
  });

  it("flags contentGap for grade 2", async () => {
    mockStudent();
    mockAttempts([{ score: 0.45, subject: "MATH", grade: 2 }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.contentGap).toBe(true);
  });

  it("flags contentGap for grade 9", async () => {
    mockStudent();
    mockAttempts([{ score: 0.55, subject: "LITERACY", grade: 9 }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.contentGap).toBe(true);
  });

  it("does not flag contentGap for grade 5", async () => {
    mockStudent();
    mockAttempts([{ score: 0.45, subject: "MATH", grade: 5 }]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.contentGap).toBe(false);
  });

  it("latest score drives recommendation type, not weighted average", async () => {
    mockStudent();
    // Latest: 0.90, second: 0.40, third: 0.40
    // Latest is 0.90 → no RETRY, no REVIEW from latest-score check
    // Not 3× below 0.65 (latest is 0.90) → no REVISIT_PREREQUISITE
    // No next unstarted lesson → no ADVANCE
    // Result: null — latest score is the authoritative signal
    mockAttempts([
      { score: 0.90, subject: "MATH" },
      { score: 0.40, subject: "MATH" },
      { score: 0.40, subject: "MATH" },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.recommendation).toBeNull();
  });

  it("REVIEW fires when latest score is in 0.60-0.74 range (2 of 3 signals)", async () => {
    mockStudent();
    // Latest: 0.68 → REVIEW
    mockAttempts([
      { score: 0.68, subject: "MATH" },
      { score: 0.40, subject: "MATH" },
      { score: 0.50, subject: "MATH" },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    // Not REVISIT (latest is above 0.65), REVIEW fires
    expect(result.recommendation?.type).toBe("REVIEW");
  });

  it("returns no recommendation when student has only high scores", async () => {
    mockStudent();
    mockAttempts([{ score: 0.92, subject: "MATH" }]);
    // No next lesson available
    mockScheduledWork([]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    // ADVANCE requires a next unstarted lesson, which we have none — so no recommendation
    expect(result.recommendation).toBeNull();
  });

  it("classifies pacing as at_risk for multiple overdue lessons", async () => {
    mockStudent();
    mockAttempts([]);
    mockScheduledWork([
      { subject: "MATH", started: false, completed: false, daysAgo: 5 },
      { subject: "MATH", started: false, completed: false, daysAgo: 4 },
      { subject: "MATH", started: false, completed: false, daysAgo: 3 },
    ]);

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.pacingSignal).toBe("at_risk");
  });

  it("classifies pacing as ahead for consistent early completion", async () => {
    mockStudent();
    mockAttempts([]);
    const scheduled = new Date(Date.now() + 86400000);
    mockPrisma.scheduledWork.findMany.mockResolvedValueOnce(
      [0, 1, 2].map((i) => ({
        id: `work${i}`,
        scheduledDate: new Date(scheduled.getTime() + i * 86400000),
        content: { contentId: `content${i}`, subject: "MATH", grade: 5, payload: { title: `Lesson ${i}` } },
        progress: [{ startedAt: new Date(), completedAt: new Date() }],
      }))
    );

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.pacingSignal).toBe("ahead");
  });

  it("generates weak-topic sequence with max five lessons and no duplicates", async () => {
    mockStudent();
    mockAttempts([{ score: 0.45, subject: "MATH", grade: 5 }]);
    mockPrisma.scheduledWork.findMany.mockResolvedValueOnce([
      {
        id: "work1",
        scheduledDate: new Date(),
        content: { contentId: "lesson-a", subject: "MATH", grade: 5, payload: { title: "Fractions A" } },
        progress: [],
      },
      {
        id: "work2",
        scheduledDate: new Date(),
        content: { contentId: "lesson-a", subject: "MATH", grade: 5, payload: { title: "Fractions A Duplicate" } },
        progress: [],
      },
    ]);
    mockPrisma.curriculumContent.findMany.mockResolvedValueOnce(
      ["lesson-b", "lesson-c", "lesson-d", "lesson-e", "lesson-f", "lesson-g"].map((contentId, index) => ({
        contentId,
        subject: "MATH",
        grade: index === 5 ? 8 : 5,
        payload: { title: contentId },
        orderInUnit: index,
        createdAt: new Date(),
      }))
    );

    const result = await getAdaptiveRecommendations("student1", "school1", "user1");

    expect(result.weakTopicSequence).toHaveLength(5);
    expect(new Set(result.weakTopicSequence.map((item) => item.lessonId)).size).toBe(5);
    expect(result.weakTopicSequence.map((item) => item.priorityOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(result.weakTopicSequence.some((item) => item.lessonId === "lesson-g")).toBe(false);
  });
});

describe("buildClassIntelligence", () => {
  it("returns zeros for empty class list", async () => {
    const result = await buildClassIntelligence([], "school1");
    expect(result.atRisk).toBe(0);
    expect(result.topPerformers).toBe(0);
    expect(result.classAvgMastery).toBe(0);
    expect(result.weakLessons).toHaveLength(0);
    expect(result.interventionRecommendations).toHaveLength(0);
  });

  it("correctly identifies at-risk and top performers", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: "s1" },
      { studentId: "s2" },
      { studentId: "s3" },
    ]);
    mockPrisma.studentProgress.findMany.mockResolvedValueOnce([]);
    mockPrisma.interventionRecommendation.findMany.mockResolvedValueOnce([]);
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValueOnce([
      { studentId: "s1", currentScore: 0.55 }, // at risk
      { studentId: "s2", currentScore: 0.85 }, // top performer
      { studentId: "s3", currentScore: 0.72 }, // neither
    ]);

    const result = await buildClassIntelligence(["class1"], "school1");

    expect(result.atRisk).toBe(1);
    expect(result.topPerformers).toBe(1);
    expect(result.classAvgMastery).toBe(71);
  });

  it("uses student user IDs, not enrollment student record IDs, when classifying pacing progress", async () => {
    const completedAt = new Date();
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: "student-record-1", Student: { userId: "user-1" } },
    ]);
    mockPrisma.studentProgress.findMany.mockResolvedValueOnce([]);
    mockPrisma.interventionRecommendation.findMany.mockResolvedValueOnce([]);
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValueOnce([]);
    mockPrisma.scheduledWork.findMany.mockResolvedValueOnce(
      [1, 2, 3].map((daysAgo) => ({
        id: `work-${daysAgo}`,
        scheduledDate: new Date(Date.now() - daysAgo * 86_400_000),
        content: { contentId: `math-${daysAgo}`, subject: "MATH", grade: 5, payload: { title: `Math ${daysAgo}` } },
        progress: [{ studentId: "user-1", startedAt: completedAt, completedAt }],
      }))
    );

    const result = await buildClassIntelligence(["class1"], "school1");

    expect(result.pacingSignalSummaries).toContainEqual(
      expect.objectContaining({ signal: "on_track", count: 1 })
    );
    expect(result.pacingSignalSummaries.some((summary) => summary.signal === "at_risk")).toBe(false);
  });

  it("counts only students affected by the weak subject lesson for weak-topic sequence summaries", async () => {
    mockPrisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: "student-record-1", Student: { userId: "user-1" } },
      { studentId: "student-record-2", Student: { userId: "user-2" } },
      { studentId: "student-record-3", Student: { userId: "user-3" } },
    ]);
    mockPrisma.studentProgress.findMany.mockResolvedValueOnce([
      {
        studentId: "user-1",
        scheduledWorkId: "work-math",
        exitTicketScore: 45,
        scheduledWork: {
          contentId: "math-weak",
          content: { subject: "MATH", payload: { title: "Fractions" } },
        },
      },
    ]);
    mockPrisma.interventionRecommendation.findMany.mockResolvedValueOnce([]);
    mockPrisma.derivedStudentProgress.findMany.mockResolvedValueOnce([
      { studentId: "student-record-1", currentScore: 0.85 },
      { studentId: "student-record-2", currentScore: 0.45 },
      { studentId: "student-record-3", currentScore: 0.50 },
    ]);
    mockPrisma.scheduledWork.findMany.mockResolvedValueOnce([
      {
        id: "work-math",
        scheduledDate: new Date(),
        content: { contentId: "math-weak", subject: "MATH", grade: 5, payload: { title: "Fractions" } },
        progress: [],
      },
      {
        id: "work-science",
        scheduledDate: new Date(),
        content: { contentId: "science-next", subject: "SCIENCE", grade: 5, payload: { title: "Plants" } },
        progress: [],
      },
    ]);

    const result = await buildClassIntelligence(["class1"], "school1");

    expect(result.atRisk).toBe(2);
    expect(result.weakTopicSequenceSummaries).toEqual([
      expect.objectContaining({
        subject: "MATH",
        count: 1,
        lessonIds: ["math-weak"],
      }),
    ]);
  });
});

describe("buildMoeCurriculumIntelligence", () => {
  it("returns structured output with concept gaps", async () => {
    mockPrisma.derivedStudentProgress.groupBy.mockResolvedValueOnce([
      { subject: "MATH", _avg: { currentScore: 0.62 } },
      { subject: "SCIENCE", _avg: { currentScore: 0.78 } },
    ]);
    mockPrisma.studentProgress.findMany.mockResolvedValueOnce([]);
    mockPrisma.curriculumContent.groupBy.mockResolvedValueOnce([
      { grade: 2, subject: "MATH", status: "APPROVED", _count: { contentId: 1 } },
      { grade: 9, subject: "LITERACY", status: "APPROVED", _count: { contentId: 1 } },
      { grade: 1, subject: "MATH", status: "APPROVED", _count: { contentId: 40 } },
    ]);
    // School comparison call
    mockPrisma.derivedStudentProgress.groupBy.mockResolvedValueOnce([]);

    const result = await buildMoeCurriculumIntelligence();

    expect(result.weakSubjects).toHaveLength(2);
    const mathSubject = result.weakSubjects.find((s) => s.subject === "MATH");
    expect(mathSubject?.gap).toBe(true);
    expect(mathSubject?.avgMastery).toBe(62);

    const criticalGap = result.conceptGaps.find((g) => g.grade === 2 && g.subject === "MATH");
    expect(criticalGap?.status).toBe("critical");

    const adequateGap = result.conceptGaps.find((g) => g.grade === 1 && g.subject === "MATH");
    expect(adequateGap?.status).toBe("adequate");
  });
});
