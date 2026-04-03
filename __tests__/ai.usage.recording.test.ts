import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckBudget = vi.hoisted(() => vi.fn());
const mockRecordAiUsage = vi.hoisted(() => vi.fn());
const mockCreateCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/budgetGuard", () => {
  return {
    checkBudget: mockCheckBudget,
  };
});

vi.mock("@/lib/ai/interactionLog", () => {
  return {
    recordAiUsage: mockRecordAiUsage,
  };
});

vi.mock("@/lib/ai/openaiClient", () => {
  return {
    getOpenAIClientOrThrow: () => ({
      chat: {
        completions: {
          create: mockCreateCompletion,
        },
      },
    }),
  };
});

import { routedCompletion } from "@/lib/ai/router";

describe("routedCompletion AI usage recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GROQ_API_KEY;
  });

  it("records AI usage after a successful completion", async () => {
    mockCheckBudget.mockResolvedValue({
      allowed: true,
      remaining: 3,
      dailyUsed: 2,
      dailyCap: 5,
      monthlyUsed: 10,
      monthlyCap: 100,
    });
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: "{\"answer\":\"ok\"}" } }],
      usage: { prompt_tokens: 120, completion_tokens: 30 },
    });

    const result = await routedCompletion({
      messages: [{ role: "user", content: "Explain fractions" }],
      aiUsage: {
        route: "/api/student/tutor",
        feature: "tutor",
        schoolId: "school-1",
        userId: "user-1",
        subject: "Mathematics",
        strandKey: "fractions",
        requestType: "explain",
      },
    });

    expect(result.model).toBe("gpt-4o-mini");
    expect(mockRecordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/student/tutor",
        feature: "tutor",
        schoolId: "school-1",
        userId: "user-1",
        tokensUsed: 150,
        model: "gpt-4o-mini",
        tier: expect.any(String),
      })
    );
  });

  it("records a budget-guard fallback without calling the provider", async () => {
    mockCheckBudget.mockResolvedValue({
      allowed: false,
      remaining: 0,
      dailyUsed: 5,
      dailyCap: 5,
      monthlyUsed: 40,
      monthlyCap: 100,
      fallbackReason: "daily_cap_reached",
    });

    const result = await routedCompletion({
      messages: [{ role: "user", content: "Explain decimals" }],
      aiUsage: {
        route: "/api/student/tutor",
        feature: "tutor",
        schoolId: "school-1",
        userId: "user-1",
        budgetFallbackContent: "{\"answer\":\"limited\"}",
      },
    });

    expect(result.budgetBlocked).toBe(true);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
    expect(mockRecordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "tutor",
        model: "budget_guard",
        tokensUsed: 0,
        estimatedCostUSD: 0,
        fallbackUsed: true,
      })
    );
  });
});
