import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());
const mockAIInteractionCreate = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      create: mockAiInteractionLogCreate,
    },
    aIInteraction: {
      create: mockAIInteractionCreate,
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

import { recordAiUsage } from "@/lib/ai/interactionLog";

describe("recordAiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiInteractionLogCreate.mockResolvedValue({ id: "legacy-1" });
    mockAIInteractionCreate.mockResolvedValue({ id: "norm-1" });
    mockLogLearningEvent.mockResolvedValue({ id: "evt-1" });
  });

  it("writes both aggregate and normalized AI interaction records", async () => {
    await recordAiUsage({
      route: "/api/student/tutor",
      feature: "tutor",
      schoolId: "school-1",
      userId: "user-1",
      subject: "Science",
      strandKey: "matter",
      requestType: "explain",
      guidanceLevel: "step_by_step",
      tokensUsed: 321,
      estimatedCostUSD: 0.12,
      model: "gpt-4o-mini",
      tier: "smart",
      fallbackUsed: false,
    });

    expect(mockAiInteractionLogCreate).toHaveBeenCalled();
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          route: "/api/student/tutor",
          feature: "tutor",
          requestType: "explain",
          subject: "Science",
          strandKey: "matter",
          provider: "openai",
          model: "gpt-4o-mini",
          tokensUsed: 321,
          estimatedCostUSD: 0.12,
        }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ai.interaction",
        source: "/api/student/tutor",
        schoolId: "school-1",
        userId: "user-1",
      })
    );
  });
});
