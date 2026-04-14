import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCategoryFindFirst = vi.hoisted(() => vi.fn());
const mockCategoryUpsert = vi.hoisted(() => vi.fn());
const mockTagCreate = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    misconceptionCategory: {
      findFirst: mockCategoryFindFirst,
      upsert: mockCategoryUpsert,
    },
    misconceptionTag: {
      create: mockTagCreate,
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

import { tagMisconception } from "@/lib/intelligence/misconceptions";

describe("tagMisconception", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategoryFindFirst.mockResolvedValue({ id: "cat-existing" });
    mockCategoryUpsert.mockResolvedValue({ id: "cat-1" });
    mockTagCreate.mockResolvedValue({ id: "tag-1" });
    mockLogLearningEvent.mockResolvedValue({ id: "evt-1" });
  });

  it("creates or updates a taxonomy category and writes a misconception tag", async () => {
    await tagMisconception({
      studentId: "student-1",
      schoolId: "school-1",
      assessmentAttemptId: "attempt-1",
      taggedByUserId: "teacher-1",
      categoryCode: "adaptive_incorrect_response",
      categoryLabel: "Adaptive Incorrect Response",
      createCategoryIfMissing: true,
      evidence: { incorrectAnswerIndices: [1, 2] },
    });

    expect(mockCategoryUpsert).toHaveBeenCalled();
    expect(mockTagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat-1",
          assessmentAttemptId: "attempt-1",
        }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "misconception.tagged",
      })
    );
  });
});
