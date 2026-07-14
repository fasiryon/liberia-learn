import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrisma,
  mockRunAgent,
  mockSendSMS,
  mockResolveKnownGuardian,
  mockExtractChallengeAttempt,
  mockResolveChallenge,
  mockCheckSmsCostCap,
  mockRecordSmsSpend,
  mockDetectSafeguardingKeywords,
  mockNotifySchoolSafeguarding,
  mockEnqueueEscalation,
} = vi.hoisted(() => ({
  mockPrisma: {
    guardianConversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    student: { findUnique: vi.fn() },
    studentGuardian: { findMany: vi.fn() },
  },
  mockRunAgent: vi.fn(),
  mockSendSMS: vi.fn(),
  mockResolveKnownGuardian: vi.fn(),
  mockExtractChallengeAttempt: vi.fn(),
  mockResolveChallenge: vi.fn(),
  mockCheckSmsCostCap: vi.fn(),
  mockRecordSmsSpend: vi.fn(),
  mockDetectSafeguardingKeywords: vi.fn(),
  mockNotifySchoolSafeguarding: vi.fn(),
  mockEnqueueEscalation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));
vi.mock("@/lib/sms", () => ({ sendSMS: mockSendSMS, sendTwoWaySMS: mockSendSMS }));
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
vi.mock("@/lib/agents/safeguarding/keywordGate", () => ({
  detectSafeguardingKeywords: mockDetectSafeguardingKeywords,
}));
vi.mock("@/lib/agents/safeguarding/notify", () => ({
  notifySchoolSafeguarding: mockNotifySchoolSafeguarding,
}));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import { handleGuardianInbound } from "@/lib/agents/sms/guardianInbound";
import { SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE } from "@/lib/agents/safeguarding/resources";

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
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.student.findUnique.mockReset();
    mockPrisma.studentGuardian.findMany.mockReset();
    mockRunAgent.mockReset();
    mockSendSMS.mockReset();
    mockResolveKnownGuardian.mockReset();
    mockExtractChallengeAttempt.mockReset();
    mockResolveChallenge.mockReset();
    mockCheckSmsCostCap.mockReset();
    mockRecordSmsSpend.mockReset();
    mockDetectSafeguardingKeywords.mockReset();
    mockNotifySchoolSafeguarding.mockReset();
    mockEnqueueEscalation.mockReset();

    mockSendSMS.mockResolvedValue({ ok: true, sid: "sms-1" });
    mockResolveKnownGuardian.mockResolvedValue(null);
    mockExtractChallengeAttempt.mockReturnValue(null);
    mockCheckSmsCostCap.mockResolvedValue({ allowed: true });
    mockRecordSmsSpend.mockResolvedValue(undefined);
    mockPrisma.guardianConversation.update.mockResolvedValue({});
    mockDetectSafeguardingKeywords.mockReturnValue(false);
    mockNotifySchoolSafeguarding.mockResolvedValue({ notifiedUserIds: [] });
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
    mockPrisma.studentGuardian.findMany.mockResolvedValue([]);
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

  it("known-number path: resolves guardianId, includes the linked studentId in context, and marks the conversation verified", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockResolveKnownGuardian.mockResolvedValue({ id: "guardian-1" });
    mockPrisma.studentGuardian.findMany.mockResolvedValue([
      { student: { id: "student-1", user: { name: "Pewu Gongloe" } } },
    ]);
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "How is my son doing?" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringMatching(/\[context: verified students=\[\{studentId=student-1 name=Pewu\}\]\]/),
      expect.objectContaining({ userId: "guardian-1" })
    );
    expect(mockPrisma.guardianConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ guardianId: "guardian-1" }) })
    );
  });

  it("known-number path: lists every linked student when a guardian has more than one child", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockResolveKnownGuardian.mockResolvedValue({ id: "guardian-1" });
    mockPrisma.studentGuardian.findMany.mockResolvedValue([
      { student: { id: "student-1", user: { name: "Pewu Gongloe" } } },
      { student: { id: "student-2", user: { name: "Musu Varney" } } },
    ]);
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "How are my kids doing?" });

    const [, agentInput] = mockRunAgent.mock.calls[0];
    expect(agentInput).toContain("studentId=student-1 name=Pewu");
    expect(agentInput).toContain("studentId=student-2 name=Musu");
  });

  it("known-number path: falls back to a plain verified marker if somehow no StudentGuardian link is found", async () => {
    mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
    mockResolveKnownGuardian.mockResolvedValue({ id: "guardian-1" });
    mockPrisma.studentGuardian.findMany.mockResolvedValue([]);
    mockRunAgent.mockResolvedValue(agentResult());

    await handleGuardianInbound({ from: "+231770000111", text: "Hi" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("[context: verified]"),
      expect.anything()
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

  describe("safeguarding keyword gate (Spec 5)", () => {
    it("short-circuits the LLM entirely and sends the fixed acknowledgment", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(
        existingConversation({ guardianId: "guardian-1", verifiedAt: new Date() })
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        guardianOf: [{ student: { user: { schoolId: "school-1" } } }],
      });
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      const result = await handleGuardianInbound({ from: "+231770000111", text: "my child was hit yesterday" });

      expect(mockRunAgent).not.toHaveBeenCalled();
      expect(result.agentStatus).toBe("SAFEGUARDING_ESCALATED");
      expect(result.response).toBe(SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE);
      expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE);
    });

    it("logs a HIGH priority EscalationQueue entry", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(
        existingConversation({ guardianId: "guardian-1", verifiedAt: new Date() })
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        guardianOf: [{ student: { user: { schoolId: "school-1" } } }],
      });
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      await handleGuardianInbound({ from: "+231770000111", text: "someone is following my child" });

      expect(mockEnqueueEscalation).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "HIGH", schoolId: "school-1", invocationId: null })
      );
    });

    it("notifies the school when a schoolId can be resolved from the known-number guardian", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(
        existingConversation({ guardianId: "guardian-1", verifiedAt: new Date() })
      );
      mockPrisma.user.findUnique.mockResolvedValue({
        guardianOf: [{ student: { user: { schoolId: "school-1" } } }],
      });
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      await handleGuardianInbound({ from: "+231770000111", text: "my child is scared to go to school" });

      expect(mockNotifySchoolSafeguarding).toHaveBeenCalledWith("school-1", expect.any(String));
    });

    it("notifies the school when schoolId comes from a granted studentId (unverified caller)", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(
        existingConversation({ state: { messages: [], grantedStudentIds: ["student-1"] } })
      );
      mockPrisma.student.findUnique.mockResolvedValue({ user: { schoolId: "school-2" } });
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      await handleGuardianInbound({ from: "+231770000111", text: "he keeps talking about self-harm" });

      expect(mockNotifySchoolSafeguarding).toHaveBeenCalledWith("school-2", expect.any(String));
    });

    it("still escalates and acknowledges even when no schoolId can be resolved (fully unverified caller)", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      const result = await handleGuardianInbound({ from: "+231770000111", text: "she wants to kill herself" });

      expect(mockEnqueueEscalation).toHaveBeenCalledWith(expect.objectContaining({ priority: "HIGH", schoolId: null }));
      expect(mockNotifySchoolSafeguarding).not.toHaveBeenCalled();
      expect(result.response).toBe(SAFEGUARDING_ACKNOWLEDGMENT_MESSAGE);
    });

    it("never rate/cost-limits the safeguarding acknowledgment", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      await handleGuardianInbound({ from: "+231770000111", text: "my child is unsafe" });

      expect(mockCheckSmsCostCap).not.toHaveBeenCalled();
      expect(mockSendSMS).toHaveBeenCalled();
      expect(mockRecordSmsSpend).toHaveBeenCalled();
    });

    it("persists the guardian message to conversation history even on the escalation path", async () => {
      mockPrisma.guardianConversation.findUnique.mockResolvedValue(existingConversation());
      mockDetectSafeguardingKeywords.mockReturnValue(true);

      await handleGuardianInbound({ from: "+231770000111", text: "my child is unsafe" });

      const updateCall = mockPrisma.guardianConversation.update.mock.calls[0][0];
      const messages = updateCall.data.state.messages as { text: string }[];
      expect(messages.some((m) => m.text === "my child is unsafe")).toBe(true);
    });
  });
});
