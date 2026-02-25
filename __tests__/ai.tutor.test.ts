/**
 * __tests__/ai.tutor.test.ts — Block 10
 *
 * Tests for the Student AI Tutor:
 *   1. Returns valid structured response for known strand
 *   2. Falls back gracefully when AI unavailable
 *   3. Rate limit enforced after daily limit reached
 *   4. No PII in constructed AI prompt
 *   5. Audit log written on each successful call
 *   6. Feature flag OFF → 404
 *   7. Budget cap hit → 503
 *   8. Missing required fields → 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireUser               = vi.hoisted(() => vi.fn());
const mockIsAiTutorEnabled          = vi.hoisted(() => vi.fn());
const mockGetAiTutorDailyLimit      = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap     = vi.hoisted(() => vi.fn());
const mockRoutedCompletion          = vi.hoisted(() => vi.fn());
const mockLogAudit                  = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent         = vi.hoisted(() => vi.fn());
const mockAuditLogCount             = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate    = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({
  isAiTutorEnabled:      mockIsAiTutorEnabled,
  getAiTutorDailyLimit:  mockGetAiTutorDailyLimit,
  getAiBudgetMonthlyCap: mockGetAiBudgetMonthlyCap,
}));
vi.mock("@/lib/ai/router", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/audit",          () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { count: mockAuditLogCount },
    aiInteractionLog: {
      aggregate: mockAiInteractionLogAggregate,
      create:    mockAiInteractionLogCreate,
    },
  },
}));

import { POST } from "@/app/api/student/tutor/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_USER = {
  id: "user-student-1",
  role: "STUDENT",
  schoolId: "school-aaa",
  isPlatformAdmin: false,
};

const VALID_BODY = {
  subject: "Mathematics",
  strandKey: "fractions.adding",
  masteryState: "DEVELOPING",
  proficiencyState: "BELOW_PROFICIENT",
  gradeBand: "upper_primary",
  requestType: "explain",
};

const VALID_AI_RESPONSE = JSON.stringify({
  explanation: "A fraction represents a part of a whole.",
  practicePrompt: "What is 1/4 + 1/4?",
  guidanceLevel: "moderate",
  confidenceScore: 0.9,
});

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/student/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function setupDefaults() {
  mockIsAiTutorEnabled.mockReturnValue(true);
  mockGetAiTutorDailyLimit.mockReturnValue(20);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireUser.mockResolvedValue(VALID_USER);
  mockAuditLogCount.mockResolvedValue(0);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: VALID_AI_RESPONSE,
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 100,
    outputTokens: 80,
    estimatedCostUSD: 0.0001,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — feature flag", () => {
  it("returns 404 when AI_TUTOR_ENABLED is false", async () => {
    mockIsAiTutorEnabled.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("ai_tutor_disabled");
    expect(mockRequireUser).not.toHaveBeenCalled();
  });
});

// ─── Valid response ───────────────────────────────────────────────────────────

describe("POST /api/student/tutor — valid response", () => {
  it("returns structured response with all required fields", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.explanation).toBe("A fraction represents a part of a whole.");
    expect(body.practicePrompt).toBe("What is 1/4 + 1/4?");
    expect(body.guidanceLevel).toBe("moderate");
    expect(typeof body.confidenceScore).toBe("number");
    expect(body.hadFallback).toBe(false);
  });

  it("calls routedCompletion with forceSmartTier=true", async () => {
    await POST(makeReq());
    expect(mockRoutedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ forceSmartTier: true })
    );
  });
});

// ─── No PII in prompt ─────────────────────────────────────────────────────────

describe("POST /api/student/tutor — PII guardrails", () => {
  it("does not include studentId in the AI prompt messages", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    expect(allText).not.toContain(VALID_USER.id);
    expect(allText).not.toContain("user-student-1");
  });

  it("does not include school name or schoolId in the AI prompt", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    expect(allText).not.toContain(VALID_USER.schoolId);
    expect(allText).not.toContain("school-aaa");
  });

  it("audit log details contain no studentId field", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.details).not.toHaveProperty("studentId");
    expect(JSON.stringify(auditArgs.details)).not.toContain("user-student-1");
  });

  it("interaction log create contains no studentId field", async () => {
    await POST(makeReq());
    const [createArgs] = mockAiInteractionLogCreate.mock.calls[0];
    expect(createArgs.data).not.toHaveProperty("studentId");
  });
});

// ─── Audit log ────────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — audit log", () => {
  it("writes audit log with action=ai.tutor.requested on success", async () => {
    await POST(makeReq());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_USER.id,
        action: "ai.tutor.requested",
        resourceType: "ai_tutor",
        schoolId: VALID_USER.schoolId,
      })
    );
  });

  it("does not write audit log when feature flag is off", async () => {
    mockIsAiTutorEnabled.mockReturnValue(false);
    await POST(makeReq());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

// ─── Rate limit ───────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — rate limit", () => {
  it("returns 429 when daily limit is reached", async () => {
    mockAuditLogCount.mockResolvedValue(20); // at limit
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limit_exceeded");
    expect(body.limit).toBe(20);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("allows call when count is below limit", async () => {
    mockAuditLogCount.mockResolvedValue(19);
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });
});

// ─── Budget cap ───────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — budget cap", () => {
  it("returns 503 when monthly spend >= cap", async () => {
    mockAiInteractionLogAggregate.mockResolvedValue({
      _sum: { estimatedCostUSD: 100 },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_budget_exhausted");
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("emits budget warning metric at 80% spend", async () => {
    mockAiInteractionLogAggregate.mockResolvedValue({
      _sum: { estimatedCostUSD: 82 }, // 82% of $100
    });
    await POST(makeReq());
    expect(mockRecordMetricEvent).toHaveBeenCalledWith(
      "ai.budget.warning",
      expect.objectContaining({ monthlySpend: 82 }),
      expect.any(Object)
    );
  });
});

// ─── Fallback ─────────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — fallback", () => {
  it("returns 200 with hadFallback=true when AI call throws", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("OpenAI unavailable"));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(typeof body.explanation).toBe("string");
    expect(body.explanation.length).toBeGreaterThan(0);
  });

  it("returns 200 with hadFallback=true when AI returns invalid JSON", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "not json at all",
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUSD: 0,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("POST /api/student/tutor — input validation", () => {
  it("returns 400 when subject is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, subject: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when strandKey is missing", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, strandKey: "" }));
    expect(res.status).toBe(400);
  });

  it("defaults requestType to 'explain' for unknown value", async () => {
    await POST(makeReq({ ...VALID_BODY, requestType: "unknown_type" }));
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const userMsg = opts.messages.find((m: any) => m.role === "user").content;
    expect(userMsg).toContain("Explain this concept");
  });
});
