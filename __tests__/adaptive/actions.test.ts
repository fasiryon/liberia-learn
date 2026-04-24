import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    interventionRecommendation: {
      create: (...args: any[]) => mockCreate(...args),
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      updateMany: (...args: any[]) => mockUpdateMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/interventions/interventionChains", () => ({
  autoTriggerIntervention: vi.fn().mockResolvedValue({ created: false, chainId: "chain-1" }),
}));

import {
  generateStudentActions,
  getActiveStudentAction,
  resolveStudentAction,
  dismissStudentAction,
} from "@/lib/intelligence/actionEngine";

const STUDENT_ID = "stu-1";
const SCHOOL_ID = "sch-1";

function baseMasteryAlert(tier: "critical" | "at_risk" | "developing") {
  return { concept: "MATH", subject: "MATH", score: tier === "critical" ? 35 : tier === "at_risk" ? 55 : 70, tier };
}

function baseRec(overrides: object = {}) {
  return {
    type: "RETRY_ASSESSMENT" as const,
    priority: 95,
    lessonId: "lesson-abc",
    scheduledWorkId: "sw-123",
    subject: "MATH",
    grade: 5,
    reason: "Latest quiz score was 45%.",
    sourceSignal: "assessment_attempt.low_score",
    masteryPercent: 45,
    confidenceTier: "medium" as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no existing action
  mockFindFirst.mockResolvedValue(null);
  mockCreate.mockResolvedValue({ id: "action-1" });
  mockUpdateMany.mockResolvedValue({ count: 0 });
  mockFindMany.mockResolvedValue([]);
  mockUpdate.mockResolvedValue({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, recommendationType: "COMPLETED" });
});

describe("generateStudentActions", () => {
  it("RETRY_ASSESSMENT with masteryPercent < 50 creates ASSIGN_REVIEW_LESSON", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({ masteryPercent: 45, sourceSignal: "assessment_attempt.low_score" }),
      masteryAlerts: [],
      contentGap: false,
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.recommendationType).toBe("ASSIGN_REVIEW_LESSON");
    expect(data.studentId).toBe(STUDENT_ID);
    expect(data.status).toBe("ACTIVE");
  });

  it("RETRY_ASSESSMENT with masteryPercent >= 50 creates ASSIGN_PRACTICE", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({ masteryPercent: 55, sourceSignal: "assessment_attempt.low_score" }),
      masteryAlerts: [],
      contentGap: false,
    });

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.recommendationType).toBe("ASSIGN_PRACTICE");
  });

  it("persistent low score (3+ failures) creates RECOMMEND_TEACHER_SUPPORT when mastery < 50", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({
        type: "REVISIT_PREREQUISITE",
        sourceSignal: "assessment_attempt.persistent_low_score",
        masteryPercent: 40,
      }),
      masteryAlerts: [baseMasteryAlert("critical"), baseMasteryAlert("critical")],
      contentGap: false,
    });

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.recommendationType).toBe("RECOMMEND_TEACHER_SUPPORT");
    expect(data.severity).toBe("high");
  });

  it("persistent low score without critical mastery creates ASSIGN_PRACTICE", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({
        type: "REVISIT_PREREQUISITE",
        sourceSignal: "assessment_attempt.persistent_low_score",
        masteryPercent: 58,
      }),
      masteryAlerts: [],
      contentGap: false,
    });

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.recommendationType).toBe("ASSIGN_PRACTICE");
  });

  it("contentGap=true creates CONTENT_GAP_NOTICE", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: null,
      masteryAlerts: [],
      contentGap: true,
      grade: 2,
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.recommendationType).toBe("CONTENT_GAP_NOTICE");
    expect(data.sourceSignal).toBe("content_gap");
  });

  it("duplicate generation does not create duplicate actions (existing found)", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "existing-action" });

    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({ masteryPercent: 45 }),
      masteryAlerts: [],
      contentGap: false,
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("recently resolved action is not re-opened", async () => {
    // First findFirst (active check) returns null, second (resolved check) returns resolved
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "resolved-action", status: "COMPLETED" });

    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({ masteryPercent: 45 }),
      masteryAlerts: [],
      contentGap: false,
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("sets correct idempotency key pattern", async () => {
    await generateStudentActions(STUDENT_ID, SCHOOL_ID, {
      recommendation: baseRec({ masteryPercent: 45 }),
      masteryAlerts: [],
      contentGap: false,
    });

    const data = mockCreate.mock.calls[0][0].data;
    expect(data.idempotencyKey).toContain(STUDENT_ID);
    expect(data.idempotencyKey).toContain("ASSIGN_REVIEW_LESSON");
    expect(data.idempotencyKey).toContain("MATH");
  });
});

describe("resolveStudentAction", () => {
  it("marks action COMPLETED and updates resolvedAt", async () => {
    await resolveStudentAction("action-1", "user-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action-1" },
        data: expect.objectContaining({ status: "COMPLETED", resolvedBy: "user-1" }),
      })
    );
  });
});

describe("dismissStudentAction", () => {
  it("marks action DISMISSED with reason", async () => {
    mockUpdate.mockResolvedValueOnce({ studentId: STUDENT_ID, schoolId: SCHOOL_ID, recommendationType: "ASSIGN_REVIEW_LESSON" });
    await dismissStudentAction("action-1", "user-1", "Student requested");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "action-1" },
        data: expect.objectContaining({ status: "DISMISSED", dismissReason: "Student requested" }),
      })
    );
  });
});

describe("getActiveStudentAction", () => {
  it("returns highest-priority action from active list", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindMany.mockResolvedValue([
      {
        id: "action-low",
        recommendationType: "CONTENT_GAP_NOTICE",
        reason: "Gap",
        severity: "medium",
        targetType: "lesson_list",
        targetId: "grade-2",
        sourceSignal: "content_gap",
        createdAt: new Date(),
      },
      {
        id: "action-high",
        recommendationType: "RECOMMEND_TEACHER_SUPPORT",
        reason: "Critical mastery",
        severity: "high",
        targetType: "support",
        targetId: "teacher",
        sourceSignal: "mastery.multi_critical",
        createdAt: new Date(),
      },
    ]);

    const result = await getActiveStudentAction(STUDENT_ID);
    expect(result?.id).toBe("action-high");
    expect(result?.actionType).toBe("RECOMMEND_TEACHER_SUPPORT");
  });

  it("returns null when no active actions exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindMany.mockResolvedValue([]);

    const result = await getActiveStudentAction(STUDENT_ID);
    expect(result).toBeNull();
  });

  it("action href for ASSIGN_PRACTICE with scheduledWorkId points to quiz", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindMany.mockResolvedValue([
      {
        id: "action-practice",
        recommendationType: "ASSIGN_PRACTICE",
        reason: "Retry quiz",
        severity: "medium",
        targetType: "scheduled_work",
        targetId: "sw-999",
        sourceSignal: "assessment_attempt.low_score",
        createdAt: new Date(),
      },
    ]);

    const result = await getActiveStudentAction(STUDENT_ID);
    expect(result?.href).toContain("sw-999");
    expect(result?.href).toContain("#lesson-quiz");
  });
});
