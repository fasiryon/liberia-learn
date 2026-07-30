import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() =>
  vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  }))
);
const mockEnqueueEscalation = vi.hoisted(() => vi.fn(async () => ({ id: "escalation-1" })));
const mockLogAIInteraction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));
vi.mock("@/lib/ai/interactionLog", () => ({ logAIInteraction: mockLogAIInteraction }));
vi.mock("@/lib/labs/registry", () => ({
  isValidLabId: () => true,
  getLabDefinition: (id: string) => ({ id, title: "Test Lab", subject: "SCIENCE", gradeLevel: 7 }),
}));
vi.mock("@/lib/labs/ai/prompts", () => ({
  buildLabStateExplainerPrompt: () => "user prompt",
  buildLabStateExplainerSystemPrompt: () => "system prompt",
  getLabExplainerPromptMetadata: () => ({ version: "1.0.0", hash: "hash" }),
}));

import { explainLabState } from "@/lib/labs/ai/explainLabState";

describe("explainLabState (NR-9.5 moderation audit follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

  it("returns the explanation when output is safe", async () => {
    mockRoutedCompletion.mockResolvedValue({ content: "The voltage increased, so current increased too." });

    const result = await explainLabState({
      labId: "electric-circuit",
      previousState: { voltage: 3 },
      nextState: { voltage: 5 },
      actionType: "SET_VOLTAGE",
    });

    expect(result).toContain("voltage increased");
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("blocks unsafe output, escalates, and returns the safe fallback", async () => {
    mockRoutedCompletion.mockResolvedValue({ content: "unsafe explanation" });
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE" });

    const result = await explainLabState({
      labId: "electric-circuit",
      previousState: { voltage: 3 },
      nextState: { voltage: 5 },
      actionType: "SET_VOLTAGE",
      schoolId: "school-1",
    });

    expect(result).toContain("Compare the before and after values");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", schoolId: "school-1" })
    );
  });
});
