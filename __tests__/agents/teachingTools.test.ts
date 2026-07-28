import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSendPushToUser } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn() },
  },
  mockSendPushToUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));

import {
  teachingSendWhisperPromptTool,
  teachingFlagOutOfScopeTool,
} from "@/lib/agents/tools/teaching.tools";

const CTX = { agentName: "teaching-runtime", userId: null, userRole: "system" as const, traceId: "trace-1" };

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset();
  mockSendPushToUser.mockReset();
});

describe("teachingSendWhisperPromptTool", () => {
  it("pushes to the session's facilitator and reports sent", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ facilitatorId: "teacher-1" });
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
    expect(result).toEqual({ sent: true });
  });

  it("returns sent:false when the session does not exist", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue(null);
    const result = await teachingSendWhisperPromptTool.handler({ sessionId: "missing", message: "x" }, CTX);
    expect(result).toEqual({ sent: false });
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("returns sent:false when the push delivers to nobody", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ facilitatorId: "teacher-1" });
    mockSendPushToUser.mockResolvedValue({ sent: 0, failed: 0, smsFallback: 0 });
    const result = await teachingSendWhisperPromptTool.handler({ sessionId: "sess-1", message: "x" }, CTX);
    expect(result).toEqual({ sent: false });
  });
});

describe("teachingFlagOutOfScopeTool", () => {
  it("always logs successfully", async () => {
    const result = await teachingFlagOutOfScopeTool.handler(
      { sessionId: "sess-1", question: "What is the capital of France?" },
      CTX
    );
    expect(result).toEqual({ logged: true });
  });
});
