import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/router", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));
vi.mock("@/lib/ai/promptRegistry", () => ({
  getPrompt: () => ({
    key: "adaptive.practice",
    version: 1,
    hash: "test-hash",
    template: "Generate safe practice.",
  }),
}));

import { generateTargetedPracticeWithUsage } from "@/lib/adaptive/practiceGenerator";

const gap = {
  strand: "fractions",
  subject: "MATH",
  grade: 6,
  currentScore: 0.4,
} as any;

function completion() {
  return {
    content: JSON.stringify({
      questions: Array.from({ length: 5 }, (_, index) => ({
        id: `q-${index + 1}`,
        prompt: `Question ${index + 1}`,
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Safe explanation",
        hintText: "Safe hint",
      })),
    }),
    inputTokens: 20,
    outputTokens: 40,
    estimatedCostUSD: 0.001,
  };
}

describe("adaptive practice minor moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoutedCompletion.mockResolvedValue(completion());
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

  it("returns generated practice only after minor output moderation passes", async () => {
    const result = await generateTargetedPracticeWithUsage(gap, "standard");

    expect(result.practice.questions).toHaveLength(5);
    expect(mockModerateText).toHaveBeenCalledWith(
      expect.any(String),
      "output",
      { audience: "minor" }
    );
  });

  it("fails closed when output moderation is not SAFE", async () => {
    mockModerateText.mockResolvedValue({ verdict: "UNCERTAIN", reason: "provider_down" });

    await expect(
      generateTargetedPracticeWithUsage(gap, "standard")
    ).rejects.toThrow("adaptive_practice_moderation_blocked");
  });
});
