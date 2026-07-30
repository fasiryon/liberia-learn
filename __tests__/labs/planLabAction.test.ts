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
  buildLabActionPlannerPrompt: () => "user prompt",
  buildLabActionPlannerSystemPrompt: () => "system prompt",
  getLabPlannerPromptMetadata: () => ({ version: "1.0.0", hash: "hash" }),
}));

import { planLabAction } from "@/lib/labs/ai/planLabAction";

describe("planLabAction (NR-9.5 moderation audit follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

  it("returns the planned action when input and output are safe", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        action: { type: "SET_VOLTAGE", value: 5 },
        confidence: 0.9,
        userFacingMessage: "Voltage increased.",
      }),
    });

    const result = await planLabAction({
      labId: "electric-circuit",
      currentState: {},
      studentRequest: "increase the voltage",
    });

    expect(result.rejected).toBe(false);
    expect(result.userFacingMessage).toBe("Voltage increased.");
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("blocks unsafe student input before calling the LLM and escalates", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNSAFE", reason: "unsafe_input" });

    const result = await planLabAction({
      labId: "electric-circuit",
      currentState: {},
      studentRequest: "something unsafe",
      schoolId: "school-1",
    });

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("input_moderation_blocked");
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH", schoolId: "school-1" })
    );
  });

  it("blocks unsafe planner output and escalates", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        action: { type: "SET_VOLTAGE", value: 5 },
        confidence: 0.9,
        userFacingMessage: "unsafe message",
      }),
    });
    mockModerateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE" }); // output

    const result = await planLabAction({
      labId: "electric-circuit",
      currentState: {},
      studentRequest: "increase the voltage",
    });

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("output_moderation_unsafe");
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "HIGH" })
    );
  });
});
