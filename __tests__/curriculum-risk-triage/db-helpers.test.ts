import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { curriculumContent: { count: mockCount } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/curriculum/riskTriageNotify", () => ({ notifyRiskReviewers: vi.fn(async () => {}) }));

import {
  BUDGET_WINDOW_DAYS,
  countRiskFlaggedAwaitingReview,
  getFlaggedCountInWindow,
  isFirstOfKindCell,
} from "@/lib/curriculum/riskTriage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFirstOfKindCell", () => {
  it("returns true when no approved rows exist for the grade and subject", async () => {
    mockCount.mockResolvedValue(0);
    await expect(isFirstOfKindCell(2, "social_studies")).resolves.toBe(true);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        contentType: "lesson",
        grade: 2,
        subject: "SOCIAL_STUDIES",
        status: { in: ["published", "APPROVED"] },
      },
    });
  });

  it("returns false when approved content already exists", async () => {
    mockCount.mockResolvedValue(3);
    await expect(isFirstOfKindCell(9, "MATH")).resolves.toBe(false);
  });
});

describe("getFlaggedCountInWindow", () => {
  it("counts flagged rows updated during the rolling budget window", async () => {
    mockCount.mockResolvedValue(5);
    await expect(getFlaggedCountInWindow()).resolves.toBe(5);
    const callArgs = mockCount.mock.calls[0][0];
    expect(callArgs.where.payload).toEqual({ path: ["riskFlagged"], equals: true });
    expect(callArgs.where.updatedAt.gte).toBeInstanceOf(Date);
    const daysAgo = (Date.now() - callArgs.where.updatedAt.gte.getTime()) / 86_400_000;
    expect(daysAgo).toBeCloseTo(BUDGET_WINDOW_DAYS, 1);
  });
});

describe("countRiskFlaggedAwaitingReview", () => {
  it("counts current flagged NEEDS_REVIEW rows without a time window", async () => {
    mockCount.mockResolvedValue(2);
    await expect(countRiskFlaggedAwaitingReview()).resolves.toBe(2);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        status: "NEEDS_REVIEW",
        payload: { path: ["riskFlagged"], equals: true },
      },
    });
  });
});
