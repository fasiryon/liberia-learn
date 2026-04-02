import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStateForTests } from "@/lib/rateLimit";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAiTeacherAssistEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAiTeacherAssistEnabled: mockIsAiTeacherAssistEnabled,
  getAiBudgetMonthlyCap: mockGetAiBudgetMonthlyCap,
}));
vi.mock("@/lib/ai/router", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    aiInteractionLog: {
      aggregate: mockAiInteractionLogAggregate,
      create: mockAiInteractionLogCreate,
    },
  },
}));

import { POST } from "@/app/api/teacher/assist/route";

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

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/teacher/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetRateLimitStateForTests();
  mockIsAiTeacherAssistEnabled.mockReturnValue(true);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue(VALID_TEACHER);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: JSON.stringify({
      reinforcementSuggestions: [
        "Use paired reading where stronger readers support peers.",
        "Introduce a vocabulary wall with key words from each lesson.",
      ],
      pacingSuggestion:
        "Spend one extra lesson on reading fluency before moving to comprehension exercises.",
      resourceHints: [
        "Refer to the Liberia literacy curriculum guide for suggested activities.",
      ],
    }),
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 120,
    outputTokens: 100,
    estimatedCostUSD: 0.00015,
  });
});

describe("POST /api/teacher/assist", () => {
  it("returns 404 when the feature flag is off", async () => {
    mockIsAiTeacherAssistEnabled.mockReturnValue(false);

    const response = await POST(makeReq());

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("ai_teacher_assist_disabled");
  });

  it("returns suggestions, pacing, and resources on success", async () => {
    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hadFallback).toBe(false);
    expect(body.reinforcementSuggestions.length).toBeGreaterThan(0);
    expect(typeof body.pacingSuggestion).toBe("string");
    expect(Array.isArray(body.resourceHints)).toBe(true);
  });

  it("does not include individual student identifiers in prompt or audit payload", async () => {
    await POST(makeReq());

    const [completionArgs] = mockRoutedCompletion.mock.calls[0];
    const promptText = completionArgs.messages.map((message: any) => message.content).join(" ");
    const [auditArgs] = mockLogAudit.mock.calls[0];

    expect(promptText).not.toMatch(/student.*id/i);
    expect(promptText).not.toContain(VALID_TEACHER.schoolId);
    expect(auditArgs.details).not.toHaveProperty("studentId");
    expect(auditArgs.details).not.toHaveProperty("studentName");
  });

  it("returns the safe hourly-limit error after 50 requests", async () => {
    for (let index = 0; index < 50; index += 1) {
      const response = await POST(makeReq());
      expect(response.status).toBe(200);
    }

    const blocked = await POST(makeReq());

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({
      error: "Too many requests",
      retryAfter: expect.any(Number),
    });
  });

  it("returns 503 when the monthly AI budget cap is exceeded", async () => {
    mockAiInteractionLogAggregate.mockResolvedValue({
      _sum: { estimatedCostUSD: 100 },
    });

    const response = await POST(makeReq());

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("ai_budget_exhausted");
  });

  it("falls back safely when the AI response is invalid", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: "not json",
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 50,
      outputTokens: 20,
      estimatedCostUSD: 0,
    });

    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hadFallback).toBe(true);
  });
});
