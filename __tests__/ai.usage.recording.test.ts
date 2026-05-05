import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckBudget = vi.hoisted(() => vi.fn());
const mockLogAIInteraction = vi.hoisted(() => vi.fn());
const mockCreateCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/budgetGuard", () => {
  return {
    checkBudget: mockCheckBudget,
  };
});

vi.mock("@/lib/ai/interactionLog", () => {
  return {
    logAIInteraction: mockLogAIInteraction,
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
    delete process.env.XAI_API_KEY;
    vi.unstubAllGlobals();
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
    expect(mockLogAIInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/student/tutor",
        feature: "tutor",
        schoolId: "school-1",
        userId: "user-1",
        inputTokens: 120,
        outputTokens: 30,
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
    expect(mockLogAIInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "tutor",
        model: "budget_guard",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        fallbackUsed: true,
      })
    );
  });

  it("routes explicitly requested Grok completions through xAI", async () => {
    process.env.XAI_API_KEY = "xai-test-key";
    mockCheckBudget.mockResolvedValue({
      allowed: true,
      remaining: 3,
      dailyUsed: 2,
      dailyCap: 5,
      monthlyUsed: 10,
      monthlyCap: 100,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"answer\":\"grok\"}" } }],
        usage: { prompt_tokens: 1000, completion_tokens: 200 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await routedCompletion({
      messages: [{ role: "user", content: "Explain fractions" }],
      aiUsage: {
        route: "/api/admin/curriculum/generate",
        feature: "curriculum",
        provider: "grok",
      },
    });

    expect(result.model).toBe("grok-3");
    expect(result.estimatedCostUSD).toBeCloseTo(0.006);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xai-test-key",
        }),
        body: expect.stringContaining("\"model\":\"grok-3\""),
      })
    );
    expect(mockLogAIInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "curriculum",
        provider: "grok",
        model: "grok-3",
        inputTokens: 1000,
        outputTokens: 200,
      })
    );
  });
});
