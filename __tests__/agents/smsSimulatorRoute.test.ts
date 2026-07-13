import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

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
vi.mock("@/lib/agents/bootstrap", () => ({}));
vi.mock("@/lib/agents/sms/identityVerification", () => ({
  resolveKnownGuardian: vi.fn(async () => null),
  extractChallengeAttempt: vi.fn(() => null),
  resolveChallenge: vi.fn(),
  emptyRateLimitState: () => ({ attemptTimestamps: [] }),
}));
vi.mock("@/lib/agents/sms/smsCost", () => ({
  checkSmsCostCap: vi.fn(async () => ({ allowed: true })),
  countSmsSegments: (t: string) => Math.ceil((t?.length ?? 0) / 160) || 1,
  recordSmsSpend: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/dev/simulate-inbound-sms/route";

const original = process.env.NODE_ENV;
afterEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = original;
});
function setEnv(v: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = v;
}

function req(body: unknown) {
  return new Request("http://x/api/dev/simulate-inbound-sms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/dev/simulate-inbound-sms", () => {
  beforeEach(() => {
    mockPrisma.guardianConversation.findUnique.mockReset();
    mockPrisma.guardianConversation.create.mockReset();
    mockPrisma.guardianConversation.update.mockReset();
    mockRunAgent.mockReset();
    mockSendSMS.mockReset();

    mockPrisma.guardianConversation.findUnique.mockResolvedValue(null);
    mockPrisma.guardianConversation.create.mockResolvedValue({
      id: "conv-1",
      guardianPhone: "+231770000111",
      guardianId: null,
      verifiedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mockPrisma.guardianConversation.update.mockResolvedValue({});
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Hi. This is LiberiaLearn Family.",
      invocationId: "inv-1",
      toolCalls: [],
      llmCostUSD: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      toolCostUnits: 0,
    });
    mockSendSMS.mockResolvedValue({ ok: true, sid: "sms-1" });
  });

  it("is not accessible in production (404)", async () => {
    setEnv("production");
    const res = await POST(req({ from: "+231770000111", text: "hi" }));
    expect(res.status).toBe(404);
  });

  it("routes the normalized inbound to the liberialearn-family agent and sends the reply", async () => {
    setEnv("development");
    const res = await POST(req({ from: "+231 770 000 111", text: "  How is my son  " }));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.normalizedFrom).toBe("+231770000111");
    expect(json.handled).toBe(true);
    expect(json.agentStatus).toBe("SUCCESS");
    expect(json.response).toBe("Hi. This is LiberiaLearn Family.");

    expect(mockRunAgent).toHaveBeenCalledWith(
      "liberialearn-family",
      expect.stringContaining("How is my son"),
      expect.objectContaining({ userRole: "system", userId: null })
    );
    expect(mockSendSMS).toHaveBeenCalledWith("+231770000111", "Hi. This is LiberiaLearn Family.");
  });

  it("does not send an SMS when the agent produces no response (e.g. feature disabled)", async () => {
    setEnv("development");
    mockRunAgent.mockResolvedValue({
      status: "FEATURE_DISABLED",
      response: null,
      invocationId: null,
      toolCalls: [],
      llmCostUSD: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
      toolCostUnits: 0,
    });
    const res = await POST(req({ from: "+231770000111", text: "hi" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.agentStatus).toBe("FEATURE_DISABLED");
    expect(json.response).toBeNull();
    expect(mockSendSMS).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is invalid", async () => {
    setEnv("development");
    const res = await POST(req({ from: "", text: "hi" }));
    expect(res.status).toBe(400);
  });
});
