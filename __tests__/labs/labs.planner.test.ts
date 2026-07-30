import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LabDefinition } from "@/lib/labs/types";

const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockLogAIInteraction = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() =>
  vi.fn(async (): Promise<{ verdict: "SAFE" | "UNSAFE" | "UNCERTAIN"; reason?: string }> => ({
    verdict: "SAFE",
  }))
);
const mockEnqueueEscalation = vi.hoisted(() => vi.fn(async () => ({ id: "escalation-1" })));

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: mockRoutedCompletion,
}));

vi.mock("@/lib/ai/interactionLog", () => ({
  logAIInteraction: mockLogAIInteraction,
}));

// NR-9.5: moderateText internally calls @/lib/ai/routedCompletion too, which
// is already mocked above for the planner's own completion. Mocking
// moderation separately keeps it from consuming that queue and breaking
// call-count assertions on mockRoutedCompletion.
vi.mock("@/lib/agents/moderation", () => ({
  moderateText: mockModerateText,
}));
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: mockEnqueueEscalation,
}));

import { labRegistry } from "@/lib/labs/registry";
import { planLabAction } from "@/lib/labs/ai/planLabAction";

const TEST_LAB: LabDefinition<unknown> = {
  id: "gravity-explorer",
  title: "Gravity Explorer",
  subject: "Physics",
  gradeBand: "Grades 7-9",
  tier: 1,
  curriculumStandards: ["standard"],
  allowedActions: ["PLAY", "PAUSE"],
  initialState: { paused: true },
  validateAction: () => ({ ok: true }),
  applyAction: (state) => state,
};

describe("planLabAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete labRegistry["gravity-explorer"];
    mockLogAIInteraction.mockResolvedValue(null);
    mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  });

  it("returns rejected: true on JSON parse failure", async () => {
    labRegistry["gravity-explorer"] = TEST_LAB;
    mockRoutedCompletion.mockResolvedValue({
      content: "not json",
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 10,
      outputTokens: 3,
      estimatedCostUSD: 0.001,
    });

    const result = await planLabAction({
      labId: "gravity-explorer",
      currentState: { paused: true },
      studentRequest: "start",
      userId: "user-1",
    });

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("invalid_planner_json");
    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(mockLogAIInteraction).toHaveBeenCalledTimes(1);
  });

  it("returns rejected: true on unknown lab", async () => {
    const result = await planLabAction({
      labId: "unknown-lab",
      currentState: {},
      studentRequest: "start",
      userId: "user-1",
    });

    expect(result.rejected).toBe(true);
    expect(result.reason).toBe("unknown_lab");
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
    expect(mockLogAIInteraction).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on first parse failure", async () => {
    labRegistry["gravity-explorer"] = TEST_LAB;
    mockRoutedCompletion
      .mockResolvedValueOnce({
        content: "not json",
        tier: "smart",
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 3,
        estimatedCostUSD: 0.001,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          rejected: false,
          action: { type: "PLAY" },
          actionType: "PLAY",
          confidence: 0.9,
          userFacingMessage: "Starting the lab.",
          reason: null,
        }),
        tier: "smart",
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 12,
        estimatedCostUSD: 0.001,
      });

    const result = await planLabAction({
      labId: "gravity-explorer",
      currentState: { paused: true },
      studentRequest: "start",
      userId: "user-1",
    });

    expect(result.rejected).toBe(false);
    expect(result.action?.type).toBe("PLAY");
    expect(mockRoutedCompletion).toHaveBeenCalledTimes(2);
    expect(mockLogAIInteraction).toHaveBeenCalledTimes(1);
  });
});
