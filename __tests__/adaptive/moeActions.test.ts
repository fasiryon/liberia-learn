import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();
const mockCreateMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumFlag: {
      findMany: (...args: any[]) => mockFindMany(...args),
      createMany: (...args: any[]) => mockCreateMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

import {
  generateCurriculumFlags,
  getActiveCurriculumFlags,
  getCurriculumFlagSummary,
  resolveCurriculumFlag,
} from "@/lib/intelligence/curriculumFlags";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockCreateMany.mockResolvedValue({ count: 1 });
  mockUpdate.mockResolvedValue({ schoolId: null, flagType: "FLAG_CURRICULUM_REVIEW", lessonId: "l-1" });
});

describe("generateCurriculumFlags", () => {
  it("weak lesson (avgScore < 60, attemptCount >= 5) creates FLAG_CURRICULUM_REVIEW", async () => {
    await generateCurriculumFlags(
      [{ contentId: "lesson-fractions", title: "Fractions", avgScore: 47, attemptCount: 8 }],
      [],
      null
    );

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].flagType).toBe("FLAG_CURRICULUM_REVIEW");
    expect(data[0].lessonId).toBe("lesson-fractions");
    expect(data[0].avgScore).toBe(47);
    expect(data[0].idempotencyKey).toContain("FLAG_CURRICULUM_REVIEW");
    expect(data[0].idempotencyKey).toContain("lesson-fractions");
  });

  it("weak lesson with < 5 attempts is NOT flagged (insufficient signal)", async () => {
    await generateCurriculumFlags(
      [{ contentId: "lesson-new", title: "New Topic", avgScore: 30, attemptCount: 3 }],
      [],
      null
    );

    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("critical concept gap creates CONTENT_GAP_NOTICE flag", async () => {
    await generateCurriculumFlags(
      [],
      [{ subject: "MATH", severity: "critical" }],
      null
    );

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].flagType).toBe("CONTENT_GAP_NOTICE");
    expect(data[0].severity).toBe("critical");
  });

  it("adequate concept gap does NOT create flag", async () => {
    await generateCurriculumFlags(
      [],
      [{ subject: "MATH", severity: "adequate" }],
      null
    );

    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("duplicate generation does not recreate existing ACTIVE flag", async () => {
    mockFindMany.mockResolvedValue([
      { idempotencyKey: "FLAG_CURRICULUM_REVIEW:national:lesson-fractions" },
    ]);

    await generateCurriculumFlags(
      [{ contentId: "lesson-fractions", title: "Fractions", avgScore: 47, attemptCount: 8 }],
      [],
      null
    );

    if (mockCreateMany.mock.calls.length > 0) {
      const { data } = mockCreateMany.mock.calls[0][0];
      expect(data.length).toBe(0);
    } else {
      expect(mockCreateMany).not.toHaveBeenCalled();
    }
  });

  it("school-scoped flag has schoolId in idempotency key", async () => {
    await generateCurriculumFlags(
      [{ contentId: "lesson-x", title: "Lesson X", avgScore: 40, attemptCount: 6 }],
      [],
      "school-abc"
    );

    const { data } = mockCreateMany.mock.calls[0][0];
    expect(data[0].idempotencyKey).toContain("school-abc");
    expect(data[0].schoolId).toBe("school-abc");
  });
});

describe("getActiveCurriculumFlags — no PII", () => {
  it("returns only aggregate curriculum data, no student fields", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "flag-1",
        flagType: "FLAG_CURRICULUM_REVIEW",
        lessonId: "lesson-fractions",
        schoolId: null,
        severity: "high",
        sourceSignal: "lesson.avg_score_below_threshold",
        avgScore: 47,
        retryRate: null,
        schoolCount: 1,
        status: "ACTIVE",
        idempotencyKey: "FLAG_CURRICULUM_REVIEW:national:lesson-fractions",
        createdAt: new Date(),
      },
    ]);

    const flags = await getActiveCurriculumFlags(null);
    expect(flags).toHaveLength(1);

    const flag = flags[0];
    // No PII fields
    expect((flag as any).studentId).toBeUndefined();
    expect((flag as any).studentName).toBeUndefined();
    expect((flag as any).userId).toBeUndefined();

    // Has expected aggregate fields
    expect(flag.flagType).toBe("FLAG_CURRICULUM_REVIEW");
    expect(flag.lessonId).toBe("lesson-fractions");
    expect(flag.avgScore).toBe(47);
    expect(flag.severity).toBe("high");
  });

  it("getCurriculumFlagSummary returns counts by severity and type", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "f1",
        flagType: "FLAG_CURRICULUM_REVIEW",
        lessonId: "l1",
        schoolId: null,
        severity: "critical",
        sourceSignal: "s1",
        avgScore: 35,
        retryRate: null,
        schoolCount: 1,
        status: "ACTIVE",
        idempotencyKey: "k1",
        createdAt: new Date(),
      },
      {
        id: "f2",
        flagType: "CONTENT_GAP_NOTICE",
        lessonId: null,
        schoolId: null,
        severity: "high",
        sourceSignal: "s2",
        avgScore: null,
        retryRate: null,
        schoolCount: 1,
        status: "ACTIVE",
        idempotencyKey: "k2",
        createdAt: new Date(),
      },
    ]);

    const summary = await getCurriculumFlagSummary(null);
    expect(summary.totalActive).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.high).toBe(1);
    expect(summary.medium).toBe(0);
    expect(summary.byType["FLAG_CURRICULUM_REVIEW"]).toBe(1);
    expect(summary.byType["CONTENT_GAP_NOTICE"]).toBe(1);
  });
});

describe("resolveCurriculumFlag", () => {
  it("marks flag RESOLVED with timestamp and user", async () => {
    await resolveCurriculumFlag("flag-1", "admin-user-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "flag-1" },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedByUserId: "admin-user-1",
        }),
      })
    );
  });
});
