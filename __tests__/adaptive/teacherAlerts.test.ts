import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateMany = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    teacherAlert: {
      createMany: (...args: any[]) => mockCreateMany(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      findFirst: (...args: any[]) => mockFindFirst(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  generateTeacherAlerts,
  getActiveTeacherAlerts,
  markAlertReviewed,
  dismissTeacherAlert,
} from "@/lib/intelligence/teacherAlerts";

const TEACHER_ID = "teacher-1";
const SCHOOL_ID = "school-1";

function mockAtRiskStudent(overrides: object = {}) {
  return {
    studentId: "stu-1",
    name: "Ahmad Kamara",
    classId: "cls-1",
    className: "Grade 5A",
    daysSinceActivity: 9,
    profileHref: "/teacher/students/stu-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue({ id: "alert-1", schoolId: SCHOOL_ID, alertType: "INACTIVE_STUDENT" });
  mockCreateMany.mockResolvedValue({ count: 1 });
  mockUpdate.mockResolvedValue({ teacherUserId: TEACHER_ID, schoolId: SCHOOL_ID, alertType: "INACTIVE_STUDENT" });
});

describe("generateTeacherAlerts", () => {
  it("inactive student (daysSinceActivity >= 7) creates INACTIVE_STUDENT alert", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [mockAtRiskStudent({ daysSinceActivity: 9 })],
      interventionRecommendations: [],
      weakLessons: [],
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0].alertType).toBe("INACTIVE_STUDENT");
    expect(data[0].reason).toContain("Ahmad Kamara");
    expect(data[0].reason).toContain("9 days");
  });

  it("student inactive < 7 days does NOT create alert", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [mockAtRiskStudent({ daysSinceActivity: 4 })],
      interventionRecommendations: [],
      weakLessons: [],
    });

    // createMany called with empty or not called
    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("intervention recommendation creates UNRESOLVED_INTERVENTION alert", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [
        { studentId: "stu-2", type: "teacher_attention", reason: "Blessing has persistent low scores." },
      ],
      weakLessons: [],
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].alertType).toBe("UNRESOLVED_INTERVENTION");
    expect(data[0].reason).toContain("Blessing");
  });

  it("weak lesson (avgScore < 60, attemptCount >= 3) creates CURRICULUM_GAP_AFFECTING_CLASS alert", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [
        { contentId: "lesson-fractions", title: "Introduction to Fractions", avgScore: 48, attemptCount: 6 },
      ],
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].alertType).toBe("CURRICULUM_GAP_AFFECTING_CLASS");
    expect(data[0].reason).toContain("Fractions");
    expect(data[0].weakLesson).toBe("Introduction to Fractions");
  });

  it("weak lesson with < 3 attempts does NOT create alert (insufficient data)", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [],
      interventionRecommendations: [],
      weakLessons: [
        { contentId: "lesson-xyz", title: "New Lesson", avgScore: 30, attemptCount: 2 },
      ],
    });

    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("alert deduplication — existing active alert prevents duplicate creation", async () => {
    mockFindMany.mockResolvedValue([
      {
        idempotencyKey: `${TEACHER_ID}:INACTIVE_STUDENT:stu-1:inactivity`,
      },
    ]);

    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [mockAtRiskStudent({ daysSinceActivity: 9 })],
      interventionRecommendations: [],
      weakLessons: [],
    });

    // createMany not called (all deduplicated)
    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("high severity alert for 14+ days inactive", async () => {
    await generateTeacherAlerts(TEACHER_ID, SCHOOL_ID, {
      atRiskStudents: [mockAtRiskStudent({ daysSinceActivity: 16 })],
      interventionRecommendations: [],
      weakLessons: [],
    });

    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].severity).toBe("high");
  });
});

describe("markAlertReviewed", () => {
  it("updates alert status to REVIEWED with timestamp", async () => {
    await markAlertReviewed("alert-1", TEACHER_ID, SCHOOL_ID);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: expect.objectContaining({ status: "REVIEWED", reviewedByUserId: TEACHER_ID }),
      })
    );
  });
});

describe("dismissTeacherAlert", () => {
  it("updates alert status to DISMISSED with reason", async () => {
    mockFindFirst.mockResolvedValue({ id: "alert-2", schoolId: SCHOOL_ID, alertType: "INACTIVE_STUDENT" });
    await dismissTeacherAlert("alert-2", TEACHER_ID, SCHOOL_ID, "Not applicable this week");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-2" },
        data: expect.objectContaining({
          status: "DISMISSED",
          dismissReason: "Not applicable this week",
        }),
      })
    );
  });
});

describe("getActiveTeacherAlerts", () => {
  it("returns sorted active alerts", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "a1",
        alertType: "INACTIVE_STUDENT",
        severity: "medium",
        reason: "Student inactive",
        studentId: "stu-1",
        weakConcept: null,
        weakLesson: null,
        recommendedAction: "Check in",
        idempotencyKey: "key-1",
        createdAt: new Date(),
      },
      {
        id: "a2",
        alertType: "UNRESOLVED_INTERVENTION",
        severity: "high",
        reason: "Persistent low score",
        studentId: "stu-2",
        weakConcept: null,
        weakLesson: null,
        recommendedAction: "Support session",
        idempotencyKey: "key-2",
        createdAt: new Date(),
      },
    ]);

    const alerts = await getActiveTeacherAlerts(TEACHER_ID, SCHOOL_ID);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].severity).toBe("high");
    expect(alerts[0].studentHref).toBe("/teacher/students/stu-2");
  });

  it("alert with no studentId has null studentHref", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "a3",
        alertType: "CURRICULUM_GAP_AFFECTING_CLASS",
        severity: "medium",
        reason: "Fractions averaging 48%",
        studentId: null,
        weakConcept: null,
        weakLesson: "Fractions",
        recommendedAction: "Reteach",
        idempotencyKey: "key-3",
        createdAt: new Date(),
      },
    ]);

    const alerts = await getActiveTeacherAlerts(TEACHER_ID, SCHOOL_ID);
    expect(alerts[0].studentHref).toBeNull();
  });
});
