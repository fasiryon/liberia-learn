import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateMany = vi.fn();
const mockFindMany = vi.fn();
const mockCreateMany = vi.fn();
const mockStudentFindMany = vi.fn();
const mockAssessmentFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    interventionRecommendation: {
      updateMany: (...args: any[]) => mockUpdateMany(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "action-1" }),
    },
    teacherAlert: {
      findMany: (...args: any[]) => mockFindMany(...args),
      createMany: (...args: any[]) => mockCreateMany(...args),
    },
    assessmentAttempt: {
      findMany: (...args: any[]) => mockAssessmentFindMany(...args),
    },
    student: {
      findMany: (...args: any[]) => mockStudentFindMany(...args),
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  resolveActionsOnLessonComplete,
  resolveActionsOnQuizPass,
} from "@/lib/intelligence/actionEngine";
import { generateTeacherAlerts } from "@/lib/intelligence/teacherAlerts";

const TEACHER_ID = "teacher-1";
const SCHOOL_ID = "school-1";
const STUDENT_ID = "stu-1";
const SCHEDULED_WORK_ID = "sw-42";
const CONTENT_ID = "content-abc";
const CLASS_ID = "cls-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 0 });
  mockFindMany.mockResolvedValue([]);
  mockCreateMany.mockResolvedValue({ count: 0 });
  mockStudentFindMany.mockResolvedValue([]);
  mockAssessmentFindMany.mockResolvedValue([]);
});

// ─────────────────────────────────────────────
// Fix 2 — Auto-resolution on lesson complete
// ─────────────────────────────────────────────

describe("resolveActionsOnLessonComplete", () => {
  it("resolves ACTIVE ASSIGN_REVIEW_LESSON for matching scheduledWorkId", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await resolveActionsOnLessonComplete(STUDENT_ID, SCHEDULED_WORK_ID);

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const { where, data } = mockUpdateMany.mock.calls[0][0];
    expect(where.studentId).toBe(STUDENT_ID);
    expect(where.targetId).toBe(SCHEDULED_WORK_ID);
    expect(where.status).toBe("ACTIVE");
    expect(where.recommendationType).toBe("ASSIGN_REVIEW_LESSON");
    expect(data.status).toBe("COMPLETED");
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("is idempotent — resolving twice succeeds without error", async () => {
    // First call: 1 record updated; second call: 0 (already COMPLETED, not ACTIVE)
    mockUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await resolveActionsOnLessonComplete(STUDENT_ID, SCHEDULED_WORK_ID);
    await resolveActionsOnLessonComplete(STUDENT_ID, SCHEDULED_WORK_ID);

    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("does not log event when no records were updated", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const { logLearningEvent } = await import("@/lib/events/logLearningEvent");
    const logSpy = vi.mocked(logLearningEvent);

    await resolveActionsOnLessonComplete(STUDENT_ID, SCHEDULED_WORK_ID);

    expect(logSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Fix 2 — Auto-resolution on quiz pass
// ─────────────────────────────────────────────

describe("resolveActionsOnQuizPass", () => {
  it("resolves ASSIGN_PRACTICE and ASSIGN_REVIEW_LESSON when score >= 0.7", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });

    await resolveActionsOnQuizPass(STUDENT_ID, SCHEDULED_WORK_ID, 0.8);

    expect(mockUpdateMany).toHaveBeenCalledOnce();
    const { where, data } = mockUpdateMany.mock.calls[0][0];
    expect(where.studentId).toBe(STUDENT_ID);
    expect(where.targetId).toBe(SCHEDULED_WORK_ID);
    expect(where.status).toBe("ACTIVE");
    expect(where.recommendationType).toEqual({ in: ["ASSIGN_PRACTICE", "ASSIGN_REVIEW_LESSON"] });
    expect(data.status).toBe("COMPLETED");
  });

  it("does NOT resolve when score < 0.7", async () => {
    await resolveActionsOnQuizPass(STUDENT_ID, SCHEDULED_WORK_ID, 0.65);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("does NOT resolve when score is exactly 0 (failed)", async () => {
    await resolveActionsOnQuizPass(STUDENT_ID, SCHEDULED_WORK_ID, 0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("resolves at exactly the 0.7 boundary", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    await resolveActionsOnQuizPass(STUDENT_ID, SCHEDULED_WORK_ID, 0.7);
    expect(mockUpdateMany).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────
// Fix 3 — REPEATED_QUIZ_FAILURE teacher alert
// ─────────────────────────────────────────────

function makeAttempt(score: number) {
  return {
    studentId: STUDENT_ID,
    score,
    metadata: { contentId: CONTENT_ID, scheduledWorkId: SCHEDULED_WORK_ID },
  };
}

describe("generateTeacherAlerts — REPEATED_QUIZ_FAILURE", () => {
  it("creates alert when student has 3+ failed attempts on same lesson", async () => {
    mockAssessmentFindMany.mockResolvedValue([
      makeAttempt(0.3),
      makeAttempt(0.4),
      makeAttempt(0.5),
    ]);
    mockStudentFindMany.mockResolvedValue([
      { id: STUDENT_ID, user: { name: "Ahmad Kamara" } },
    ]);
    // No existing keys
    mockFindMany.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
      classIds: [CLASS_ID],
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    const failAlert = data.find((d: any) => d.alertType === "REPEATED_QUIZ_FAILURE");
    expect(failAlert).toBeDefined();
    expect(failAlert.severity).toBe("high");
    expect(failAlert.studentId).toBe(STUDENT_ID);
    expect(failAlert.reason).toContain("Ahmad Kamara");
    expect(failAlert.reason).toContain("3 times");
    expect(failAlert.idempotencyKey).toContain("REPEATED_QUIZ_FAILURE");
    expect(failAlert.idempotencyKey).toContain(STUDENT_ID);
    expect(failAlert.idempotencyKey).toContain(CONTENT_ID);
  });

  it("does NOT create alert when max score >= 70% (student eventually passed)", async () => {
    mockAssessmentFindMany.mockResolvedValue([
      makeAttempt(0.4),
      makeAttempt(0.5),
      makeAttempt(0.8), // passed
    ]);
    mockFindMany.mockResolvedValue([]);

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
      classIds: [CLASS_ID],
    });

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("does NOT create alert when fewer than 3 attempts", async () => {
    mockAssessmentFindMany.mockResolvedValue([
      makeAttempt(0.3),
      makeAttempt(0.4),
    ]);
    mockFindMany.mockResolvedValue([]);

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
      classIds: [CLASS_ID],
    });

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("deduplicates — existing active alert key prevents new creation", async () => {
    mockAssessmentFindMany.mockResolvedValue([
      makeAttempt(0.3),
      makeAttempt(0.4),
      makeAttempt(0.5),
    ]);
    mockStudentFindMany.mockResolvedValue([
      { id: STUDENT_ID, user: { name: "Ahmad Kamara" } },
    ]);
    const existingKey = `${TEACHER_ID}:REPEATED_QUIZ_FAILURE:${STUDENT_ID}:${CONTENT_ID}`;
    mockFindMany.mockResolvedValue([{ idempotencyKey: existingKey }]);

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
      classIds: [CLASS_ID],
    });

    // Alerts array not empty, but all keys already exist → newAlerts empty → createMany not called
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("skips quiz failure query when classIds not provided", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
    });

    expect(mockAssessmentFindMany).not.toHaveBeenCalled();
  });

  it("scopes query to provided classIds only", async () => {
    mockAssessmentFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [],
      classIds: ["cls-a", "cls-b"],
    });

    expect(mockAssessmentFindMany).toHaveBeenCalledOnce();
    const { where } = mockAssessmentFindMany.mock.calls[0][0];
    expect(where.classId).toEqual({ in: ["cls-a", "cls-b"] });
  });
});
