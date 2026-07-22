import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClassFindUnique = vi.hoisted(() => vi.fn());
const mockEnrollmentFindMany = vi.hoisted(() => vi.fn());
const mockAssessmentAttemptFindMany = vi.hoisted(() => vi.fn());
const mockMasterySnapshotFindMany = vi.hoisted(() => vi.fn());
const mockDerivedStudentProgressFindMany = vi.hoisted(() => vi.fn());
const mockAssignmentFindMany = vi.hoisted(() => vi.fn());
const mockStudentMasteryProfileFindMany = vi.hoisted(() => vi.fn());
const mockCurriculumContentCount = vi.hoisted(() => vi.fn());
const mockCurriculumContentFindMany = vi.hoisted(() => vi.fn());
const mockStudentProgressCount = vi.hoisted(() => vi.fn());
const mockCertificateFindUnique = vi.hoisted(() => vi.fn());
const mockStudentFindUnique = vi.hoisted(() => vi.fn());
const mockScheduledWorkFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: mockClassFindUnique },
    enrollment: { findMany: mockEnrollmentFindMany },
    assessmentAttempt: { findMany: mockAssessmentAttemptFindMany },
    masterySnapshot: { findMany: mockMasterySnapshotFindMany },
    derivedStudentProgress: { findMany: mockDerivedStudentProgressFindMany },
    assignment: { findMany: mockAssignmentFindMany },
    studentMasteryProfile: { findMany: mockStudentMasteryProfileFindMany },
    curriculumContent: { count: mockCurriculumContentCount, findMany: mockCurriculumContentFindMany },
    studentProgress: { count: mockStudentProgressCount },
    certificate: { findUnique: mockCertificateFindUnique },
    student: { findUnique: mockStudentFindUnique },
    scheduledWork: { findMany: mockScheduledWorkFindMany },
  },
}));

import { buildClassDifferentiationRollup } from "@/lib/teacher/classDifferentiation";
import { getAdaptiveRecommendations } from "@/lib/student/adaptiveRecommendations";

const STUDENT_A = { studentId: "student-a", userId: "user-a", name: "Amara Kollie", currentGrade: 6 };
const STUDENT_B = { studentId: "student-b", userId: "user-b", name: "Blessing Toe", currentGrade: 6 };

function baseMocks() {
  mockClassFindUnique.mockResolvedValue({ id: "class-1", name: "Grade 6 Math", schoolId: "school-1" });
  mockEnrollmentFindMany.mockResolvedValue([
    { studentId: STUDENT_A.studentId, Student: { userId: STUDENT_A.userId, currentGrade: STUDENT_A.currentGrade, user: { name: STUDENT_A.name } } },
    { studentId: STUDENT_B.studentId, Student: { userId: STUDENT_B.userId, currentGrade: STUDENT_B.currentGrade, user: { name: STUDENT_B.name } } },
  ]);
  mockAssessmentAttemptFindMany.mockResolvedValue([]);
  mockAssignmentFindMany.mockResolvedValue([]);
  mockStudentMasteryProfileFindMany.mockResolvedValue([]);
  mockMasterySnapshotFindMany.mockResolvedValue([]);
  mockDerivedStudentProgressFindMany.mockResolvedValue([]);
  mockCurriculumContentCount.mockResolvedValue(0);
  mockCurriculumContentFindMany.mockResolvedValue([]);
  mockStudentProgressCount.mockResolvedValue(0);
  mockCertificateFindUnique.mockResolvedValue(null);
  mockStudentFindUnique.mockResolvedValue(null);
  mockScheduledWorkFindMany.mockResolvedValue([]);
}

describe("buildClassDifferentiationRollup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baseMocks();
  });

  it("groups a student with a critical mastery score into the CRITICAL_MASTERY group", async () => {
    // AssessmentAttempt.score is a 0-1 fraction in production (confirmed against
    // real data), not a 0-100 percentage - 0.3 means 30%.
    mockAssessmentAttemptFindMany.mockResolvedValue([
      { studentId: STUDENT_A.studentId, subject: "MATH", score: 0.3, attemptedAt: new Date() },
    ]);

    const result = await buildClassDifferentiationRollup("class-1");
    const criticalGroup = result.groups.find((g) => g.type === "CRITICAL_MASTERY");
    expect(criticalGroup).toBeDefined();
    expect(criticalGroup!.students.map((s) => s.studentId)).toContain(STUDENT_A.studentId);
  });

  it("groups a student with no signals as ON_TRACK", async () => {
    const result = await buildClassDifferentiationRollup("class-1");
    const onTrack = result.groups.find((g) => g.type === "ON_TRACK");
    expect(onTrack).toBeDefined();
    expect(onTrack!.students.map((s) => s.studentId).sort()).toEqual(
      [STUDENT_A.studentId, STUDENT_B.studentId].sort()
    );
  });

  it("groups a student with an overdue assignment into the OVERDUE group", async () => {
    const dueAt = new Date(Date.now() - 3 * 86_400_000);
    mockAssignmentFindMany.mockResolvedValue([
      { id: "assign-1", title: "Fractions HW", dueAt, submissions: [{ studentId: STUDENT_B.studentId }] },
    ]);

    const result = await buildClassDifferentiationRollup("class-1");
    const overdueGroup = result.groups.find((g) => g.type === "OVERDUE");
    expect(overdueGroup).toBeDefined();
    expect(overdueGroup!.students.map((s) => s.studentId)).toEqual([STUDENT_A.studentId]);
  });

  it("does not call the per-student route computation - only fixed batched queries regardless of class size", async () => {
    // 60 students, matching the plan's cited real class-size ceiling.
    const manyStudents = Array.from({ length: 60 }, (_, i) => ({
      studentId: `student-${i}`,
      Student: { userId: `user-${i}`, currentGrade: 7, user: { name: `Student ${i}` } },
    }));
    mockEnrollmentFindMany.mockResolvedValue(manyStudents);

    await buildClassDifferentiationRollup("class-1");

    // One call per signal type, not one call per student.
    expect(mockAssessmentAttemptFindMany).toHaveBeenCalledTimes(1);
    expect(mockMasterySnapshotFindMany).toHaveBeenCalledTimes(1);
    expect(mockDerivedStudentProgressFindMany).toHaveBeenCalledTimes(1);
    expect(mockAssignmentFindMany).toHaveBeenCalledTimes(1);
  });

  it("throws 404 for a class that does not exist", async () => {
    mockClassFindUnique.mockResolvedValue(null);
    await expect(buildClassDifferentiationRollup("missing-class")).rejects.toMatchObject({ status: 404 });
  });
});

describe("equivalence: batched mastery signal matches the existing per-student path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baseMocks();
  });

  it("produces the same weakest-subject mastery score as getAdaptiveRecommendations for the same raw data", async () => {
    // Identical raw rows fed to both paths for the same student.
    const rawAttempts = [
      { studentId: STUDENT_A.studentId, subject: "MATH", score: 0.28, attemptedAt: new Date("2026-07-01") },
      { studentId: STUDENT_A.studentId, subject: "MATH", score: 0.32, attemptedAt: new Date("2026-06-20") },
    ];

    // Batched path.
    mockAssessmentAttemptFindMany.mockResolvedValue(rawAttempts);
    const batchedResult = await buildClassDifferentiationRollup("class-1");
    const batchedStudentA = batchedResult.groups
      .flatMap((g) => g.students)
      .find((s) => s.studentId === STUDENT_A.studentId)!;
    expect(batchedStudentA.hero?.type).toBe("CRITICAL_MASTERY");
    const batchedScore = batchedStudentA.hero?.masteryPercent;

    // Existing per-student path (lib/student/adaptiveRecommendations.ts, the same
    // module _computeToday calls), exercised directly with equivalent raw rows for
    // the same student and the same underlying prisma mocks (no ad hoc overrides).
    mockStudentFindUnique.mockResolvedValue({ id: STUDENT_A.studentId, enrollments: [] });
    mockAssessmentAttemptFindMany.mockResolvedValue(
      rawAttempts.map((a) => ({ ...a, id: "x", grade: 6, submittedAt: null, metadata: null }))
    );

    const perStudentResult = await getAdaptiveRecommendations(STUDENT_A.studentId, "school-1", STUDENT_A.userId);
    const perStudentWeakest = perStudentResult.masteryAlerts[0];

    expect(perStudentWeakest).toBeDefined();
    expect(perStudentWeakest.subject).toBe("MATH");
    expect(batchedScore).toBe(perStudentWeakest.score);
  });
});
