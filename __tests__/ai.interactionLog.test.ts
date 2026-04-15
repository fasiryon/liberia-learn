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

import { logAIInteraction } from "@/lib/ai/interactionLog";

describe("logAIInteraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiInteractionLogCreate.mockResolvedValue({ id: "legacy-1" });
    mockAIInteractionCreate.mockResolvedValue({ id: "norm-1" });
    mockLogLearningEvent.mockResolvedValue({ id: "evt-1" });
  });

  it("writes both aggregate and normalized AI interaction records", async () => {
    await logAIInteraction({
      route: "/api/student/tutor",
      feature: "tutor",
      schoolId: "school-1",
      userId: "user-1",
      studentId: "student-1",
      subject: "Science",
      strandKey: "matter",
      requestType: "explain",
      guidanceLevel: "step_by_step",
      inputTokens: 300,
      outputTokens: 21,
      estimatedCostUSD: 0.12,
      model: "gpt-4o-mini",
      tier: "smart",
      fallbackUsed: false,
      promptKey: "student.tutor.system",
      promptVersion: "1.1.0",
      promptHash: "hash-1",
      clientEventId: "client-evt-1",
      dedupeKey: "tutor:science:matter",
      metadata: {
        prompt: "should be stripped",
        traceId: "trace-1",
      },
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
          promptVersion: "1.1.0",
          promptKey: "student.tutor.system",
          clientEventId: "client-evt-1",
          dedupeKey: "tutor:science:matter",
          metadata: expect.objectContaining({
            traceId: "trace-1",
          }),
        }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ai.interaction",
        source: "/api/student/tutor",
        schoolId: "school-1",
        userId: "user-1",
        studentId: "student-1",
        clientEventId: "client-evt-1",
        dedupeKey: "tutor:science:matter",
      })
    );
  });

  it("strips raw prompt text and direct identifiers from telemetry metadata", async () => {
    await logAIInteraction({
      route: "/api/student/tutor",
      feature: "tutor",
      userId: "user-1",
      schoolId: "school-1",
      metadata: {
        prompt: "Explain this full student answer in detail",
        studentName: "Asha Doe",
        studentEmail: "asha@example.com",
        traceId: "trace-2",
        safeNested: {
          responsePreview: "too much raw text",
          rubricId: "rubric-1",
        },
      },
    });

    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: {
            normalizedFeature: "tutor",
            traceId: "trace-2",
            safeNested: {
              rubricId: "rubric-1",
            },
          },
        }),
      })
    );
  });
});
