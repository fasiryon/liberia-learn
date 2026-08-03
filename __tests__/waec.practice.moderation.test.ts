import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());
const mockCreateMany = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    waecPracticeItem: {
      count: mockCount,
      createMany: mockCreateMany,
    },
  },
}));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));

import { ensureBank } from "@/lib/waec/practice";

describe("WAEC practice minor moderation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(0);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        questions: [
          {
            prompt: "What is 2 + 2?",
            options: ["1", "2", "3", "4"],
            correctIndex: 3,
            explanation: "Two plus two is four.",
          },
        ],
      }),
      inputTokens: 20,
      outputTokens: 20,
      estimatedCostUSD: 0.001,
    });
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
    mockCreateMany.mockResolvedValue({ count: 1 });
  });

  it("persists newly generated questions only after minor moderation passes", async () => {
    await ensureBank("waec_math", 11);

    expect(mockCreateMany).toHaveBeenCalled();
    expect(mockModerateText).toHaveBeenCalledWith(
      expect.any(String),
      "output",
      { audience: "minor" }
    );
  });

  it("does not persist generated questions when moderation is not SAFE", async () => {
    mockModerateText.mockResolvedValue({ verdict: "UNCERTAIN", reason: "provider_down" });

    await ensureBank("waec_math", 11);

    expect(mockCreateMany).not.toHaveBeenCalled();
  });
});
