import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSendPushToUser } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findFirst: vi.fn() },
  },
  mockSendPushToUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));

import {
  teachingSendWhisperPromptTool,
  teachingFlagOutOfScopeTool,
} from "@/lib/agents/tools/teaching.tools";

const CTX = {
  agentName: "teaching-runtime",
  userId: "teacher-1",
  userRole: "system" as const,
  schoolId: "school-1",
  traceId: "sess-1",
};

beforeEach(() => {
  delete process.env.TEACHING_RUNTIME_COST_SIM;
  mockPrisma.teachingSession.findFirst.mockReset();
  mockSendPushToUser.mockReset();
});

describe("teachingSendWhisperPromptTool", () => {
  it("normalizes the observed snake_case session id alias before validation", () => {
    expect(
      teachingSendWhisperPromptTool.inputSchema.parse({
        session_id: "sess-1",
        message: "Try a concrete example.",
      })
    ).toEqual({
      sessionId: "sess-1",
      message: "Try a concrete example.",
    });
  });

  it("pushes to the session's facilitator and reports sent", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({ facilitatorId: "teacher-1" });
    mockSendPushToUser.mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 });

    const result = await teachingSendWhisperPromptTool.handler(
      { sessionId: "sess-1", message: "Try checking on the back row." },
      CTX
    );

    expect(mockSendPushToUser).toHaveBeenCalledWith("teacher-1", {
      title: "Teaching Coach",
      body: "Try checking on the back row.",
      url: "/teach/session/sess-1",
    });
    expect(mockPrisma.teachingSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sess-1",
        facilitatorId: "teacher-1",
        schoolId: "school-1",
      },
      select: { facilitatorId: true },
    });
    expect(result).toEqual({ sent: true });
  });

  it("returns sent:false when the session does not exist", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue(null);
    const result = await teachingSendWhisperPromptTool.handler(
      { sessionId: "sess-1", message: "x" },
      CTX
    );
    expect(result).toEqual({ sent: false });
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("returns sent:false when the push delivers to nobody", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({ facilitatorId: "teacher-1" });
    mockSendPushToUser.mockResolvedValue({ sent: 0, failed: 0, smsFallback: 0 });
    const result = await teachingSendWhisperPromptTool.handler({ sessionId: "sess-1", message: "x" }, CTX);
    expect(result).toEqual({ sent: false });
  });

  it("suppresses real push side effects during the paid cost simulation", async () => {
    process.env.TEACHING_RUNTIME_COST_SIM = "true";
    const result = await teachingSendWhisperPromptTool.handler(
      { sessionId: "sess-1", message: "x" },
      CTX
    );
    expect(result).toEqual({ sent: false });
    expect(mockPrisma.teachingSession.findFirst).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("rejects a cross-session push target before reading or sending", async () => {
    await expect(
      teachingSendWhisperPromptTool.handler(
        { sessionId: "other-session", message: "x" },
        CTX
      )
    ).rejects.toThrow("Teaching session context mismatch");

    expect(mockPrisma.teachingSession.findFirst).not.toHaveBeenCalled();
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });
});

describe("teachingFlagOutOfScopeTool", () => {
  it("normalizes observed session_id and message aliases before validation", () => {
    expect(
      teachingFlagOutOfScopeTool.inputSchema.parse({
        session_id: "sess-1",
        message: "What is the capital of France?",
      })
    ).toEqual({
      sessionId: "sess-1",
      question: "What is the capital of France?",
    });
  });

  it("always logs successfully", async () => {
    const result = await teachingFlagOutOfScopeTool.handler(
      { sessionId: "sess-1", question: "What is the capital of France?" },
      CTX
    );
    expect(result).toEqual({ logged: true });
  });

  it("rejects an out-of-scope signal for another session", async () => {
    await expect(
      teachingFlagOutOfScopeTool.handler(
        { sessionId: "other-session", question: "What about calculus?" },
        CTX
      )
    ).rejects.toThrow("Teaching session context mismatch");
  });
});
