import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssessmentAttemptFindMany = vi.hoisted(() => vi.fn());
const mockLearningEventFindMany = vi.hoisted(() => vi.fn());
const mockStudentCount = vi.hoisted(() => vi.fn());
const mockSchoolFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
    studentProgress: { findMany: mockStudentProgressFindMany },
    assessmentAttempt: { findMany: mockAssessmentAttemptFindMany },
    learningEvent: { findMany: mockLearningEventFindMany },
    student: { count: mockStudentCount },
    school: { findMany: mockSchoolFindMany },
  },
}));

describe("decision support analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds school admin intelligence from scheduled work, progress, and attempts", async () => {
    mockClassFindMany.mockResolvedValue([
      {
        id: "class-1",
        name: "JSS 1A",
        subject: "MATH",
        teacherId: "teacher-1",
        Teacher: { id: "teacher-1", name: "Teacher One", email: "t1@example.com" },
        _count: { enrollments: 2 },
      },
    ]);
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "work-1",
        classId: "class-1",
        isDelivered: true,
        content: { subject: "MATH", payload: { subject: "MATH" } },
      },
      {
        id: "work-2",
        classId: "class-1",
        isDelivered: false,
        content: { subject: "MATH", payload: { subject: "MATH" } },
      },
    ]);
    mockStudentProgressFindMany.mockResolvedValue([
      { scheduledWorkId: "work-1", startedAt: new Date(), completedAt: new Date() },
      { scheduledWorkId: "work-1", startedAt: new Date(), completedAt: null },
    ]);
    mockAssessmentAttemptFindMany.mockResolvedValue([
      { classId: "class-1", subject: "MATH", score: 0.55 },
      { classId: "class-1", subject: "MATH", score: 0.65 },
    ]);
    mockLearningEventFindMany.mockResolvedValue([
      { studentId: "student-1" },
      { studentId: "student-2" },
    ]);
    mockStudentCount.mockResolvedValue(4);

    const { buildAdminSchoolIntelligence } = await import(
      "@/lib/analytics/decisionSupport"
    );

    const result = await buildAdminSchoolIntelligence({
      schoolId: "school-1",
      days: 30,
    });

    expect(result.engagementLevels).toMatchObject({
      totalStudents: 4,
      activeStudents: 2,
      activeRatePct: 50,
      lessonStarts: 2,
      lessonCompletions: 1,
      completionRatePct: 50,
    });
    expect(result.teacherEffectiveness[0]).toMatchObject({
      teacherId: "teacher-1",
      deliveryRatePct: 50,
      lessonCompletionRatePct: 25,
      averageQuizScorePct: 60,
    });
    expect(result.weakSubjects[0]).toMatchObject({ subject: "MATH" });
  });

  it("builds MOE decision intelligence without student-level leakage", async () => {
    mockSchoolFindMany.mockResolvedValue([
      {
        id: "school-1",
        name: "Central High",
        district: "Monrovia",
        districtId: "district-1",
        District: { id: "district-1", name: "Monrovia" },
        _count: { users: 10 },
      },
    ]);
    mockScheduledWorkFindMany.mockResolvedValue([
      {
        id: "work-1",
        isDelivered: true,
        class: { schoolId: "school-1" },
        content: { subject: "MATH", payload: { subject: "MATH" } },
      },
    ]);
    mockAssessmentAttemptFindMany.mockResolvedValue([
      { schoolId: "school-1", subject: "MATH", score: 0.45 },
      { schoolId: "school-1", subject: "MATH", score: 0.55 },
    ]);
    mockLearningEventFindMany.mockResolvedValue([
      { schoolId: "school-1", studentId: "student-1" },
      { schoolId: "school-1", studentId: "student-2" },
    ]);
    mockStudentCount.mockResolvedValue(10);

    const { buildMoeDecisionIntelligence } = await import(
      "@/lib/analytics/decisionSupport"
    );

    const result = await buildMoeDecisionIntelligence(30);

    expect(result.districtComparisons[0]).toMatchObject({
      districtName: "Monrovia",
      averageQuizScorePct: 50,
      deliveryRatePct: 100,
      activeRatePct: 20,
    });
    expect(result.subjectWeaknessHeatmap[0]).toMatchObject({
      subject: "MATH",
      severity: "medium",
      attempts: 2,
    });
    expect(JSON.stringify(result)).not.toContain("student-1");
  });
});
