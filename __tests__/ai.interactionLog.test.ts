import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());
const mockAIInteractionCreate = vi.hoisted(() => vi.fn());
const mockAIInteractionFindFirst = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      create: mockAiInteractionLogCreate,
    },
    aIInteraction: {
      create: mockAIInteractionCreate,
      findFirst: mockAIInteractionFindFirst,
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
    mockAIInteractionFindFirst.mockResolvedValue(null);
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

describe("logAIInteraction dedup by generationCorrelationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiInteractionLogCreate.mockResolvedValue({ id: "legacy-1" });
    mockAIInteractionFindFirst.mockResolvedValue(null);
    mockLogLearningEvent.mockResolvedValue({ id: "evt-1" });
  });

  const baseCall = (overrides: Partial<Parameters<typeof logAIInteraction>[0]> = {}) => ({
    route: "curriculum.waecBaselineAlignment",
    feature: "curriculum" as const,
    model: "gpt-4o-mini",
    inputTokens: 100,
    outputTokens: 20,
    estimatedCostUSD: 0.0005,
    ...overrides,
  });

  it("gives one logical provider call one stable invocation identity, persisted once", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-1", durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ generationCorrelationId: "corr-1" }) })
    );
    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create a second canonical AIInteraction row for a duplicate persistence attempt", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-2", durable: true }));

    // Second call for the same invocation (e.g. routedCompletion's own
    // internal write plus a caller's defensive durable write) -- simulate
    // by having findUnique now report the row created above.
    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-2", durable: true }));

    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create a duplicate legacy log row for a duplicate persistence attempt", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-3", durable: true }));

    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-3", durable: true }));

    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(1);
  });

  it("stays race-safe when two calls for the same correlation id are genuinely concurrent (not sequential)", async () => {
    // Simulate real I/O latency so both calls' findFirst genuinely overlap
    // in time -- this reproduces the exact race the live staging proof
    // caught before this mutex existed (routedCompletion's own internal
    // write racing a caller's immediately-following durable write).
    let createCount = 0;
    mockAIInteractionFindFirst.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(null), 5))
    );
    mockAIInteractionCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          createCount += 1;
          setTimeout(() => resolve({ id: `row-race-${createCount}` }), 5);
        })
    );

    const [first, second] = await Promise.all([
      logAIInteraction(baseCall({ generationCorrelationId: "corr-race", durable: true })),
      logAIInteraction(baseCall({ generationCorrelationId: "corr-race", durable: true })),
    ]);

    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(1);
    void first;
    void second;
  });

  it("preserves a genuinely new provider call as a distinct row when the correlation id differs", async () => {
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-a" })
      .mockResolvedValueOnce({ id: "row-b" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-a", durable: true }));
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-b", durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2);
    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(2);
  });

  it("keeps two independent calls with identical input/prompt distinct when they carry different correlation ids", async () => {
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-x" })
      .mockResolvedValueOnce({ id: "row-y" });
    const identicalInput = baseCall({ generationCorrelationId: "corr-x", promptKey: "k", promptHash: "h" });
    await logAIInteraction(identicalInput);
    await logAIInteraction({ ...identicalInput, generationCorrelationId: "corr-y" });
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2);
  });

  it("counts cost from the canonical row only, not doubled by a duplicate persistence attempt", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-cost", estimatedCostUSD: 0.001337, durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estimatedCostUSD: 0.001337 }) })
    );

    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-cost", estimatedCostUSD: 0.001337, durable: true }));
    // Still exactly one create call -- a second attempt never inserts a second
    // row, so any aggregate reading AIInteraction never double-counts cost.
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
  });

  it("does not require a generationCorrelationId to persist (calls without one are never deduped against each other)", async () => {
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-p" })
      .mockResolvedValueOnce({ id: "row-q" });
    await logAIInteraction(baseCall({ feature: "tutor" }));
    await logAIInteraction(baseCall({ feature: "tutor" }));
    expect(mockAIInteractionFindFirst).not.toHaveBeenCalled();
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2);
  });

  it("durable mode surfaces a genuine persistence failure even though the dedup lookup succeeded", async () => {
    mockAIInteractionFindFirst.mockResolvedValueOnce(null);
    mockAIInteractionCreate.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(
      logAIInteraction(baseCall({ generationCorrelationId: "corr-fail", durable: true }))
    ).rejects.toThrow("db unavailable");
  });
});
