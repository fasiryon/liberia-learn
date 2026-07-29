import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRunAgent } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn(), update: vi.fn() },
    teachingTurn: { findMany: vi.fn(), create: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
  mockRunAgent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));

import { runTeachingTurn } from "@/lib/teaching/runtime";

const SESSION = {
  id: "sess-1",
  contentId: "content-1",
  facilitatorId: "teacher-1",
  schoolId: "school-1",
  grade: "7",
  subject: "Mathematics",
  alignmentMode: "FULL_CONFIDENCE",
  status: "ACTIVE",
};

const CONTENT = {
  id: "content-1",
  payload: { body: "Fractions are parts of a whole.", objectives: ["Understand fractions"] },
};

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset().mockResolvedValue(SESSION);
  mockPrisma.teachingSession.update
    .mockReset()
    .mockResolvedValue({ nextTurnIndex: 1 });
  mockPrisma.teachingTurn.findMany.mockReset().mockResolvedValue([]);
  mockPrisma.teachingTurn.create
    .mockReset()
    .mockImplementation(({ data }) => Promise.resolve({ id: "turn-1", ...data }));
  mockPrisma.curriculumContent.findUnique.mockReset().mockResolvedValue(CONTENT);
  mockRunAgent.mockReset();
});

describe("runTeachingTurn", () => {
  it("calls runAgent with userRole 'system' and persists a TeachingTurn on success", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Fractions represent parts of a whole.",
      invocationId: "inv-1",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 100,
      llmTokensOut: 40,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "facilitator", text: "Explain fractions." },
      { userRole: "TEACHER" }
    );

    expect(mockRunAgent).toHaveBeenCalledWith(
      "teaching-runtime",
      expect.stringMatching(
        /Teaching session ID: sess-1[\s\S]*Fractions are parts of a whole\./
      ),
      expect.objectContaining({ userId: "teacher-1", userRole: "system", schoolId: "school-1" })
    );
    expect(result.responseText).toBe("Fractions represent parts of a whole.");
    expect(result.guardrailMode).toBe("FULL_CONFIDENCE");
    expect(result.deferred).toBe(false);
    expect(result.turnIndex).toBe(0);
    expect(mockPrisma.curriculumContent.findUnique).toHaveBeenCalledWith({
      where: { contentId: "content-1" },
    });
    expect(mockPrisma.teachingTurn.create).toHaveBeenCalledOnce();
  });

  it("marks a turn as deferred when the agent calls teaching.flagOutOfScope", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "I'm not sure about that one, let's ask your teacher.",
      invocationId: "inv-2",
      toolCalls: [
        {
          tool: "teaching.flagOutOfScope",
          args: { sessionId: "sess-1", question: "What about calculus?" },
          result: { logged: true },
          costUnits: 0,
          ok: true,
        },
      ],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "student", text: "What about calculus?" },
      { userRole: "TEACHER" }
    );
    expect(result.deferred).toBe(true);
  });

  it("persists an honest teacher-referred deferral even when the model skips the tool call", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response:
        "I don't know that one for certain, let's check with your teacher.",
      invocationId: "inv-safe-deferral",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "student", text: "What is the capital of France?" },
      { userRole: "TEACHER" }
    );

    expect(result.deferred).toBe(true);
    expect(mockPrisma.teachingTurn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deferred: true }),
    });
  });

  it("does not infer a deferral from uncertainty without a teacher referral", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "I am not sure which fraction you mean. Please point to it.",
      invocationId: "inv-uncertain",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "student", text: "Which fraction?" },
      { userRole: "TEACHER" }
    );

    expect(result.deferred).toBe(false);
  });

  it("reports whisperSent true when the agent calls teaching.sendWhisperPrompt successfully", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Let's continue with the next example.",
      invocationId: "inv-3",
      toolCalls: [
        {
          tool: "teaching.sendWhisperPrompt",
          args: { sessionId: "sess-1", message: "Check on the back row." },
          result: { sent: true },
          costUnits: 0,
          ok: true,
        },
      ],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "facilitator", text: "Continue." },
      { userRole: "TEACHER" }
    );
    expect(result.whisperSent).toBe(true);
  });

  it("throws when the session is not ACTIVE", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ ...SESSION, status: "COMPLETED" });
    await expect(
      runTeachingTurn("sess-1", { role: "facilitator", text: "Hi" }, { userRole: "TEACHER" })
    ).rejects.toThrow(/not active/i);
  });

  it("does not persist a turn when the agent is disabled or otherwise unavailable", async () => {
    mockRunAgent.mockResolvedValue({
      status: "FEATURE_DISABLED",
      response: null,
      invocationId: null,
      toolCalls: [],
      llmCostUSD: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      toolCostUnits: 0,
      error: "feature_disabled",
    });

    await expect(
      runTeachingTurn(
        "sess-1",
        { role: "facilitator", text: "Start." },
        { userRole: "TEACHER" }
      )
    ).rejects.toMatchObject({
      code: "teaching_agent_unavailable",
      status: 503,
    });
    expect(mockPrisma.teachingTurn.create).not.toHaveBeenCalled();
  });

  it("increments turnIndex based on prior turn count", async () => {
    mockPrisma.teachingSession.update.mockResolvedValue({ nextTurnIndex: 3 });
    mockPrisma.teachingTurn.findMany.mockResolvedValue([
      { turnIndex: 0, role: "facilitator", deferred: false },
      { turnIndex: 1, role: "student", deferred: false },
    ]);
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Next part of the lesson.",
      invocationId: "inv-4",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn(
      "sess-1",
      { role: "facilitator", text: "Continue." },
      { userRole: "TEACHER" }
    );
    expect(result.turnIndex).toBe(2);
  });

  it("atomically reserves distinct indexes for parallel turn submissions", async () => {
    mockPrisma.teachingSession.update
      .mockResolvedValueOnce({ nextTurnIndex: 1 })
      .mockResolvedValueOnce({ nextTurnIndex: 2 });
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "A grounded response.",
      invocationId: "inv-parallel",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const [first, second] = await Promise.all([
      runTeachingTurn(
        "sess-1",
        { role: "student", text: "First question." },
        { userRole: "TEACHER" }
      ),
      runTeachingTurn(
        "sess-1",
        { role: "student", text: "Second question." },
        { userRole: "TEACHER" }
      ),
    ]);

    expect([first.turnIndex, second.turnIndex].sort()).toEqual([0, 1]);
    const storedIndexes = mockPrisma.teachingTurn.create.mock.calls
      .map(([args]) => args.data.turnIndex)
      .sort();
    expect(storedIndexes).toEqual([0, 1]);
  });
});
