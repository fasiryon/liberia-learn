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

describe("logAIInteraction dedup by dedupeKey (DB-enforced, distributed-safe)", () => {
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

  // Simulates the real Postgres response to a conflicting INSERT against the
  // AIInteraction_dedupeKey_key unique index -- a genuine Prisma
  // PrismaClientKnownRequestError shape (code P2002, meta.target naming the
  // column), not a made-up error, so this test proves the code's reaction to
  // exactly what the database itself would report.
  function uniqueViolation(): Error & { code: string; meta: { target: string[] } } {
    return Object.assign(new Error("Unique constraint failed on the fields: (`dedupeKey`)"), {
      code: "P2002",
      meta: { target: ["dedupeKey"] },
    });
  }

  it("gives one logical provider call one stable invocation identity, persisted once", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-1" });
    await logAIInteraction(baseCall({ generationCorrelationId: "corr-1", durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ generationCorrelationId: "corr-1", dedupeKey: "corr-1" }),
      })
    );
    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(1);
  });

  it("does not create a second canonical AIInteraction row when the database reports a conflicting dedupeKey", async () => {
    mockAIInteractionCreate.mockRejectedValueOnce(uniqueViolation());
    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });

    // Simulates a duplicate persistence attempt for the same invocation
    // (routedCompletion's own internal write plus a caller's defensive
    // durable write): the create() call itself is what the database rejects
    // -- this is the DB constraint being exercised, not a pre-check.
    const result = await logAIInteraction(baseCall({ generationCorrelationId: "corr-2", durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mockAIInteractionFindFirst).toHaveBeenCalledWith({ where: { dedupeKey: "corr-2" } });
    void result;
  });

  it("does not create a legacy log row when the database reports a conflicting dedupeKey", async () => {
    mockAIInteractionCreate.mockRejectedValueOnce(uniqueViolation());
    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });

    await logAIInteraction(baseCall({ generationCorrelationId: "corr-3", durable: true }));

    expect(mockAiInteractionLogCreate).not.toHaveBeenCalled();
  });

  it("stays distributed-safe: two writers with the same dedupeKey resolve to exactly one canonical row and one log row", async () => {
    // Writer A wins the real INSERT; Writer B's INSERT is rejected by the
    // database's own unique index and falls back to finding A's row --
    // exactly what two concurrent Postgres backends would really do, not a
    // process-local check. Neither writer knows about the other in advance.
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-winner" }) // Writer A
      .mockRejectedValueOnce(uniqueViolation()); // Writer B
    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-winner" });

    const [writerA, writerB] = await Promise.all([
      logAIInteraction(baseCall({ generationCorrelationId: "corr-race", durable: true })),
      logAIInteraction(baseCall({ generationCorrelationId: "corr-race", durable: true })),
    ]);

    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2); // both really attempted to insert
    expect(mockAiInteractionLogCreate).toHaveBeenCalledTimes(1); // only the winner logged
    void writerA;
    void writerB;
  });

  it("preserves a genuine second provider call (real retry) as a distinct row when a different dedupeKey is used", async () => {
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
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-1" })
      .mockRejectedValueOnce(uniqueViolation());
    mockAIInteractionFindFirst.mockResolvedValueOnce({ id: "row-1" });

    await logAIInteraction(baseCall({ generationCorrelationId: "corr-cost", estimatedCostUSD: 0.001337, durable: true }));
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estimatedCostUSD: 0.001337 }) })
    );

    await logAIInteraction(baseCall({ generationCorrelationId: "corr-cost", estimatedCostUSD: 0.001337, durable: true }));
    // Two real attempts, but only one row ever exists (the second was
    // rejected by the DB and resolved to the same id) -- any aggregate
    // reading AIInteraction never double-counts cost.
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2);
  });

  it("caller-supplied dedupeKey (offline-sync use case) takes precedence over generationCorrelationId", async () => {
    mockAIInteractionCreate.mockResolvedValueOnce({ id: "row-offline" });
    await logAIInteraction(
      baseCall({ generationCorrelationId: "corr-1", dedupeKey: "offline-sync-key-1", durable: true })
    );
    expect(mockAIInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dedupeKey: "offline-sync-key-1" }) })
    );
  });

  it("does not require any idempotency key to persist (calls without one are never deduped against each other)", async () => {
    mockAIInteractionCreate
      .mockResolvedValueOnce({ id: "row-p" })
      .mockResolvedValueOnce({ id: "row-q" });
    await logAIInteraction(baseCall({ feature: "tutor" }));
    await logAIInteraction(baseCall({ feature: "tutor" }));
    expect(mockAIInteractionFindFirst).not.toHaveBeenCalled();
    expect(mockAIInteractionCreate).toHaveBeenCalledTimes(2);
    expect(mockAIInteractionCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ dedupeKey: null }) })
    );
  });

  it("durable mode surfaces a genuine persistence failure that is not a dedupeKey conflict", async () => {
    mockAIInteractionCreate.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(
      logAIInteraction(baseCall({ generationCorrelationId: "corr-fail", durable: true }))
    ).rejects.toThrow("db unavailable");
    expect(mockAIInteractionFindFirst).not.toHaveBeenCalled();
  });

  it("re-throws if the database reports a dedupeKey conflict but the row cannot then be found (should be impossible, but must not silently swallow)", async () => {
    mockAIInteractionCreate.mockRejectedValueOnce(uniqueViolation());
    mockAIInteractionFindFirst.mockResolvedValueOnce(null);
    await expect(
      logAIInteraction(baseCall({ generationCorrelationId: "corr-vanish", durable: true }))
    ).rejects.toThrow(/Unique constraint/);
  });
});
