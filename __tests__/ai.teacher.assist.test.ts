/**
 * __tests__/ai.teacher.assist.test.ts — Block 10
 *
 * Tests for the Teacher Support Assistant:
 *   1. Suggestions generated for weak strands
 *   2. Punitive language in AI response triggers fallback
 *   3. No individual student data in prompt
 *   4. Fallback on AI failure
 *   5. Feature flag OFF → 404
 *   6. Rate limit enforcement
 *   7. Audit log written on each call
 *   8. Non-TEACHER role → 403
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole                    = vi.hoisted(() => vi.fn());
const mockIsAiTeacherAssistEnabled       = vi.hoisted(() => vi.fn());
const mockGetAiTeacherAssistDailyLimit   = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap          = vi.hoisted(() => vi.fn());
const mockRoutedCompletion               = vi.hoisted(() => vi.fn());
const mockLogAudit                       = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent              = vi.hoisted(() => vi.fn());
const mockAuditLogCount                  = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate      = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate         = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAiTeacherAssistEnabled:      mockIsAiTeacherAssistEnabled,
  getAiTeacherAssistDailyLimit:  mockGetAiTeacherAssistDailyLimit,
  getAiBudgetMonthlyCap:         mockGetAiBudgetMonthlyCap,
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

import { POST } from "@/app/api/teacher/assist/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TEACHER = {
  id: "teacher-1",
  role: "TEACHER",
  schoolId: "school-aaa",
  isPlatformAdmin: false,
};

const VALID_BODY = {
  subject: "English",
  strandKey: "reading.comprehension",
  classAverageMasteryState: "DEVELOPING",
  weakStrandKeys: ["reading.fluency", "reading.vocabulary"],
  gradeBand: "upper_primary",
};

const VALID_AI_RESPONSE = JSON.stringify({
  reinforcementSuggestions: [
    "Use paired reading where stronger readers support peers.",
    "Introduce a vocabulary wall with key words from each lesson.",
  ],
  pacingSuggestion:
    "Spend one extra lesson on reading fluency before moving to comprehension exercises.",
  resourceHints: [
    "Refer to the Liberia literacy curriculum guide for suggested activities.",
  ],
});

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/teacher/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function setupDefaults() {
  mockIsAiTeacherAssistEnabled.mockReturnValue(true);
  mockGetAiTeacherAssistDailyLimit.mockReturnValue(50);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue(VALID_TEACHER);
  mockAuditLogCount.mockResolvedValue(0);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: VALID_AI_RESPONSE,
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 120,
    outputTokens: 100,
    estimatedCostUSD: 0.00015,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — feature flag", () => {
  it("returns 404 when AI_TEACHER_ASSIST_ENABLED is false", async () => {
    mockIsAiTeacherAssistEnabled.mockReturnValue(false);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("ai_teacher_assist_disabled");
    expect(mockRequireRole).not.toHaveBeenCalled();
  });
});

// ─── Valid response ───────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — valid response", () => {
  it("returns reinforcementSuggestions array", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.reinforcementSuggestions)).toBe(true);
    expect(body.reinforcementSuggestions.length).toBeGreaterThan(0);
  });

  it("returns pacingSuggestion string", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(typeof body.pacingSuggestion).toBe("string");
    expect(body.pacingSuggestion.length).toBeGreaterThan(0);
  });

  it("returns resourceHints array", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(Array.isArray(body.resourceHints)).toBe(true);
  });

  it("generates suggestions when weakStrandKeys is non-empty", async () => {
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body.hadFallback).toBe(false);
    // The weak strand keys should appear in the prompt
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const userMsg = opts.messages.find((m: any) => m.role === "user").content;
    expect(userMsg).toContain("reading.fluency");
  });
});

// ─── No individual student data ───────────────────────────────────────────────

describe("POST /api/teacher/assist — no individual student data", () => {
  it("prompt contains no studentId", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    expect(allText).not.toMatch(/student.*id/i);
    expect(allText).not.toContain("student-");
  });

  it("prompt contains no school name or schoolId", async () => {
    await POST(makeReq());
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const allText = opts.messages.map((m: any) => m.content).join(" ");
    expect(allText).not.toContain(VALID_TEACHER.schoolId);
  });

  it("audit log details contain no student identifiers", async () => {
    await POST(makeReq());
    const [auditArgs] = mockLogAudit.mock.calls[0];
    expect(auditArgs.details).not.toHaveProperty("studentId");
    expect(auditArgs.details).not.toHaveProperty("studentName");
    expect(JSON.stringify(auditArgs.details)).not.toContain("student-");
  });
});

// ─── Punitive language guardrail ──────────────────────────────────────────────

describe("POST /api/teacher/assist — punitive language guardrail", () => {
  it("falls back when AI response contains punitive language", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        reinforcementSuggestions: ["Address the failure of students to engage."],
        pacingSuggestion: "This class is underperforming badly.",
        resourceHints: ["Review basics due to incompetent approach."],
      }),
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 80,
      estimatedCostUSD: 0.00012,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
  });

  it("fallback suggestions do not contain punitive language", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("AI down"));
    const res = await POST(makeReq());
    const body = await res.json();
    const allText = [
      ...body.reinforcementSuggestions,
      body.pacingSuggestion,
      ...body.resourceHints,
    ].join(" ").toLowerCase();
    const punitiveWords = ["fail", "incompetent", "blame", "deficit"];
    for (const w of punitiveWords) {
      expect(allText).not.toContain(w);
    }
  });
});

// ─── Fallback on AI failure ───────────────────────────────────────────────────

describe("POST /api/teacher/assist — fallback", () => {
  it("returns 200 with hadFallback=true when AI throws", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("OpenAI unavailable"));
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
    expect(Array.isArray(body.reinforcementSuggestions)).toBe(true);
    expect(body.reinforcementSuggestions.length).toBeGreaterThan(0);
  });

  it("returns 200 with hadFallback=true when AI returns invalid JSON", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "here are some suggestions (not json)",
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 50,
      outputTokens: 20,
      estimatedCostUSD: 0,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hadFallback).toBe(true);
  });
});

// ─── Rate limit ───────────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — rate limit", () => {
  it("returns 429 when daily limit is reached", async () => {
    mockAuditLogCount.mockResolvedValue(50);
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — auth", () => {
  it("returns 403 when user is not a teacher", async () => {
    mockRequireRole.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
});

// ─── Audit log ────────────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — audit log", () => {
  it("writes audit log with correct action on success", async () => {
    await POST(makeReq());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: VALID_TEACHER.id,
        action: "ai.teacher.assist.requested",
        resourceType: "ai_teacher_assist",
        schoolId: VALID_TEACHER.schoolId,
      })
    );
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("POST /api/teacher/assist — input validation", () => {
  it("returns 400 when subject is empty", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, subject: "" }));
    expect(res.status).toBe(400);
  });

  it("caps weakStrandKeys at 10 items", async () => {
    const lotsOfStrands = Array.from({ length: 15 }, (_, i) => `strand.${i}`);
    await POST(makeReq({ ...VALID_BODY, weakStrandKeys: lotsOfStrands }));
    const [opts] = mockRoutedCompletion.mock.calls[0];
    const userMsg = opts.messages.find((m: any) => m.role === "user").content;
    // Should include first 10 strands, not all 15
    expect(userMsg).toContain("strand.9");
    expect(userMsg).not.toContain("strand.10");
  });
});
