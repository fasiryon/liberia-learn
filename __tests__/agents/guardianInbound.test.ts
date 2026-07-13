import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRunAgent, mockSendSMS } = vi.hoisted(() => {
  const mockPrisma = {
    guardianConversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockRunAgent = vi.fn();
  const mockSendSMS = vi.fn();
  return { mockPrisma, mockRunAgent, mockSendSMS };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));
vi.mock("@/lib/sms", () => ({ sendSMS: mockSendSMS }));

import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";

function agentResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: "SUCCESS",
    response: "Hi there.",
    invocationId: "inv-1",
    toolCalls: [],
    llmCostUSD: 0,
    llmTokensIn: 0,
    llmTokensOut: 0,
    toolCostUnits: 0,
    ...overrides,
  };
}

describe("handleGuardianInbound", () => {
  beforeEach(() => {
    mockPrisma.guardianConversation.findUnique.mockReset();
    mockPrisma.guardianConversation.create.mockReset();
    mockPrisma.guardianConversation.update.mockReset();
    mockRunAgent.mockReset();
    mockSendSMS.mockReset();
    mockSendSMS.mockResolvedValue({ ok: true, sid: "sms-1" });
  });

  it("creates a new conversation for a first-time phone number", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(null);
    mockPrisma.guardianConversation.create.mockResolvedValue({
      id: "conv-new",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mockRunAgent.mockResolvedValue(agentResult());

    const result = await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockPrisma.guardianConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guardianPhone: "+231770000111" }) })
    );
    expect(result.handled).toBe(true);
    expect(result.response).toBe("Hi there.");
  });

  it("reuses an existing, non-expired conversation without creating a new one", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-existing",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: [{ from: "guardian", text: "earlier", at: new Date().toISOString() }] },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "Hi again" });

    expect(mockPrisma.guardianConversation.create).not.toHaveBeenCalled();
    expect(mockPrisma.guardianConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conv-existing" },
        data: expect.objectContaining({
          state: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({ text: "earlier" }),
              expect.objectContaining({ text: "Hi again" }),
            ]),
          }),
        }),
      })
    );
  });

  it("resets conversation state (but not identity fields) once the conversation has expired", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-expired",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: [{ from: "guardian", text: "old message", at: new Date().toISOString() }] },
      expiresAt: new Date(Date.now() - 1000),
    });
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "fresh start" });

    const updateCall = mockPrisma.guardianConversation.update.mock.calls[0][0];
    const messages = updateCall.data.state.messages as { text: string }[];
    expect(messages.some((m) => m.text === "old message")).toBe(false);
    expect(messages.some((m) => m.text === "fresh start")).toBe(true);
  });

  it("always invokes the agent with userRole 'system' and unresolved identity (verification pending)", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: [] },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      "Hi",
      expect.objectContaining({ userId: null, userRole: "system" })
    );
  });

  it("sends the agent's response via SMS to the normalized number", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: [] },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockRunAgent.mockResolvedValue(agentResult({ response: "Your reply." }));

    await handleGuardianInbound({ from: "+231 (770) 000-111", text: "Hi" });

    expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", "Your reply.");
  });

  it("does not send an SMS when the agent has no response", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: [] },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockRunAgent.mockResolvedValue(agentResult({ status: "COST_CAPPED", response: null }));

    await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("caps stored conversation history at 10 messages", async () => {
    const manyMessages = Array.from({ length: 10 }, (_, i) => ({
      from: "guardian" as const,
      text: `msg-${i}`,
      at: new Date().toISOString(),
    }));
    mockPrisma.guardianConversation.findUnique.mockResolvedValue({
      id: "conv-1",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      state: { messages: manyMessages },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockRunAgent.mockResolvedValue(agentResult({ response: "reply" }));

    await handleGuardianInbound({ from: "+231770000111", text: "new one" });

    const updateCall = mockPrisma.guardianConversation.update.mock.calls[0][0];
    const messages = updateCall.data.state.messages as { text: string }[];
    expect(messages.length).toBeLessThanOrEqual(10);
    expect(messages[messages.length - 2].text).toBe("new one");
  });

  it("rejects an empty text with a 400-tagged error", async () => {
    await expect(handleGuardianInbound({ from: "+231770000111", text: "" })).rejects.toMatchObject({
      status: 400,
    });
  });
});
