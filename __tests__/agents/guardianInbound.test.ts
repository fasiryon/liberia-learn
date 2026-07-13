import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRunAgent, mockSendSMS, mockResolveKnownGuardian, mockExtractChallengeAttempt, mockResolveChallenge, mockCheckSmsCostCap, mockRecordSmsSpend } =
  vi.hoisted(() => ({
    mockPrisma: {
      guardianConversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
    mockRunAgent: vi.fn(),
    mockSendSMS: vi.fn(),
    mockResolveKnownGuardian: vi.fn(),
    mockExtractChallengeAttempt: vi.fn(),
    mockResolveChallenge: vi.fn(),
    mockCheckSmsCostCap: vi.fn(),
    mockRecordSmsSpend: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));
vi.mock("@/lib/sms", () => ({ sendSMS: mockSendSMS }));
vi.mock("@/lib/agents/sms/identityVerification", () => ({
  resolveKnownGuardian: mockResolveKnownGuardian,
  extractChallengeAttempt: mockExtractChallengeAttempt,
  resolveChallenge: mockResolveChallenge,
  emptyRateLimitState: () => ({ attemptTimestamps: [] }),
}));
vi.mock("@/lib/agents/sms/smsCost", () => ({
  checkSmsCostCap: mockCheckSmsCostCap,
  countSmsSegments: (t: string) => Math.ceil((t?.length ?? 0) / 160) || 1,
  recordSmsSpend: mockRecordSmsSpend,
}));

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

function existingConversation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "conv-1",
    guardianPhone: "+231770000111",
    guardianId: null,
    verifiedAt: null,
    state: { messages: [] },
    expiresAt: new Date(Date.now() + 60_000),
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
    mockResolveKnownGuardian.mockReset();
    mockExtractChallengeAttempt.mockReset();
    mockResolveChallenge.mockReset();
    mockCheckSmsCostCap.mockReset();
    mockRecordSmsSpend.mockReset();

    mockSendSMS.mockResolvedValue({ ok: true, sid: "sms-1" });
    mockResolveKnownGuardian.mockResolvedValue(null);
    mockExtractChallengeAttempt.mockReturnValue(null);
    mockCheckSmsCostCap.mockResolvedValue({ allowed: true });
    mockRecordSmsSpend.mockResolvedValue(undefined);
    mockPrisma.guardianConversation.update.mockResolvedValue({});
  });

  it("creates a new conversation for a first-time phone number", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(null);
    mockPrisma.guardianConversation.create.mockResolvedValue(existingConversation());
    mockRunAgent.mockResolvedValue(agentResult());

    const result = await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockPrisma.guardianConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guardianPhone: "+231770000111" }) })
    );
    expect(result.handled).toBe(true);
    expect(result.response).toBe("Hi there.");
  });

  it("sends an [context: unverified] marker to the agent for an unrecognized, unverified caller", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("[context: unverified]"),
      expect.objectContaining({ userId: null, userRole: "system" })
    );
  });

  it("known-number path: resolves guardianId and marks the conversation verified", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockResolveKnownGuardian.mockResolvedValue({ id: "guardian-1" });
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "How is my son doing?" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("[context: verified]"),
      expect.objectContaining({ userId: "guardian-1" })
    );
    expect(mockPrisma.guardianConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guardianId: "guardian-1" }) })
    );
  });

  it("reuses an already-known guardianId on a later message without re-resolving", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(
      existingConversation({ guardianId: "guardian-1", verifiedAt: new Date() })
    );
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "Hi again" });

    expect(mockResolveKnownGuardian).not.toHaveBeenCalled();
    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.any(String),
      expect.objectContaining({ userId: "guardian-1" })
    );
  });

  it("challenge match: grants the studentId and injects it into the agent context", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockExtractChallengeAttempt.mockReturnValue({ studentIdCandidate: "student-1", nameCandidate: "Pewu" });
    mockResolveChallenge.mockResolvedValue({
      result: { outcome: "matched", studentId: "student-1", studentFirstName: "Pewu" },
      rateLimitState: { attemptTimestamps: [] },
    });
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "cktest... Pewu" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("studentId=student-1"),
      expect.objectContaining({ userId: null, grantedStudentIds: ["student-1"] })
    );
  });

  it("challenge failure: replies with a fixed message and does not call the agent", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockExtractChallengeAttempt.mockReturnValue({ studentIdCandidate: "student-1", nameCandidate: "Wrong" });
    mockResolveChallenge.mockResolvedValue({
      result: { outcome: "name_mismatch" },
      rateLimitState: { attemptTimestamps: ["2026-07-13T12:00:00Z"] },
    });

    const result = await handleGuardianInbound({ from: "+231770000111", text: "cktest... Wrong" });

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(result.agentStatus).toBe("VERIFICATION_FAILED");
    expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", expect.stringContaining("couldn't verify"));
  });

  it("rate limited: replies with the rate-limit message and does not call the agent", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockExtractChallengeAttempt.mockReturnValue({ studentIdCandidate: "student-1", nameCandidate: "Pewu" });
    mockResolveChallenge.mockResolvedValue({
      result: { outcome: "rate_limited", rateLimitReason: "hourly" },
      rateLimitState: { attemptTimestamps: [] },
    });

    const result = await handleGuardianInbound({ from: "+231770000111", text: "cktest... Pewu" });

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(result.agentStatus).toBe("RATE_LIMITED");
    expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", expect.stringContaining("Too many attempts"));
  });

  it("reuses a previously granted studentId on a later message in the same conversation", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(
      existingConversation({ state: { messages: [], grantedStudentIds: ["student-1"] } })
    );
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "How is he doing in math?" });

    expect(mockExtractChallengeAttempt).not.toHaveBeenCalled();
    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("studentId=student-1"),
      expect.objectContaining({ grantedStudentIds: ["student-1"] })
    );
  });

  it("suppresses the SMS send when the cost cap is hit (and does not record spend)", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockRunAgent.mockResolvedValue(agentResult({ response: "a reply" }));
    mockCheckSmsCostCap.mockResolvedValue({ allowed: false, reason: "guardian_daily_cap" });

    await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockSendSMS).not.toHaveBeenCalled();
    expect(mockRecordSmsSpend).not.toHaveBeenCalled();
  });

  it("bypasses the cost cap for a safeguarding escalation response", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockRunAgent.mockResolvedValue(
      agentResult({
        response: "I hear you, and this is serious.",
        toolCalls: [{ tool: "safeguarding.escalate", ok: true, args: {}, result: {}, costUnits: 1 }],
      })
    );
    mockCheckSmsCostCap.mockResolvedValue({ allowed: false, reason: "guardian_daily_cap" });

    await handleGuardianInbound({ from: "+231770000111", text: "my child was hurt" });

    expect(mockCheckSmsCostCap).not.toHaveBeenCalled();
    expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", "I hear you, and this is serious.");
    expect(mockRecordSmsSpend).toHaveBeenCalled();
  });

  it("does not send an SMS when the agent has no response", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
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
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(
      existingConversation({ state: { messages: manyMessages } })
    );
    mockRunAgent.mockResolvedValue(agentResult({ response: "reply" }));

    await handleGuardianInbound({ from: "+231770000111", text: "new one" });

    const updateCall = mockPrisma.guardianConversation.update.mock.calls[0][0];
    const messages = updateCall.data.state.messages as { text: string }[];
    expect(messages.length).toBeLessThanOrEqual(10);
    expect(messages[messages.length - 2].text).toBe("new one");
  });

  it("rejects an empty text with a 400-tagged error", async () => {
    await expect(handleGuardianInbound({ from: "+231770000111", text: "" })).rejects.toMatchObject({ status: 400 });
  });
});
