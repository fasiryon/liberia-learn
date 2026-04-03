import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAggregate = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      aiInteractionLog: {
        aggregate: mockAggregate,
      },
    },
  };
});

vi.mock("@/lib/logger", () => {
  return {
    logger: {
      warn: mockWarn,
      error: mockError,
    },
  };
});

vi.mock("@/lib/serverFlags", () => {
  return {
    getAiBudgetDailyCap: () => 25,
    getAiBudgetMonthlyCap: () => 100,
    getAiTutorDailyBudgetUsd: () => 5,
    getAiTeacherAssistDailyBudgetUsd: () => 10,
    getAiGradingDailyBudgetUsd: () => 8,
    getAiCurriculumDailyBudgetUsd: () => 20,
  };
});

import { checkBudget } from "@/lib/ai/budgetGuard";

describe("AI budget guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests when daily and monthly spend are under cap", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 2 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 20 } });

    const result = await checkBudget("tutor", "school-1");

    expect(result.allowed).toBe(true);
    expect(result.dailyUsed).toBe(2);
    expect(result.monthlyUsed).toBe(20);
    expect(result.remaining).toBe(3);
  });

  it("blocks requests when the feature daily cap is reached", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 5 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 20 } });

    const result = await checkBudget("tutor", "school-1");

    expect(result.allowed).toBe(false);
    expect(result.fallbackReason).toBe("daily_cap_reached");
  });

  it("blocks requests when the monthly cap is reached", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 2 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 100 } });

    const result = await checkBudget("teacherAssist", "school-1");

    expect(result.allowed).toBe(false);
    expect(result.fallbackReason).toBe("monthly_cap_reached");
  });

  it("emits warning and error logs when thresholds are crossed", async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 4.1 } })
      .mockResolvedValueOnce({ _sum: { estimatedCostUSD: 95 } });

    await checkBudget("tutor", "school-1");

    expect(mockWarn).toHaveBeenCalled();
    expect(mockError).toHaveBeenCalled();
  });
});
