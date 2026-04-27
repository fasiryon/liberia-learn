import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStateForTests } from "@/lib/rateLimit";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAiTutorEnabled = vi.hoisted(() => vi.fn());
const mockIsRagTutorEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAiTutorEnabled: mockIsAiTutorEnabled,
  isRagTutorEnabled: mockIsRagTutorEnabled,
  getAiBudgetMonthlyCap: mockGetAiBudgetMonthlyCap,
  isAiTrustIndicatorsEnabled: () => false,
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

import { POST } from "@/app/api/student/tutor/route";

const VALID_USER = {
  id: "user-student-1",
  role: "STUDENT",
  schoolId: "school-aaa",
  isPlatformAdmin: false,
};

const VALID_BODY = {
  subject: "Mathematics",
  strandKey: "fractions.adding",
  lessonTitle: "Adding Fractions",
  lessonContent:
    "Fractions represent equal parts of a whole. To add fractions with the same denominator, add the numerators and keep the denominator.",
  question: "Explain how to add fractions with the same denominator.",
  gradeLevel: 6,
  masteryState: "DEVELOPING",
  proficiencyState: "BELOW_PROFICIENT",
  gradeBand: "upper_primary",
  requestType: "explain",
};

function makeReq(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/student/tutor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetRateLimitStateForTests();
  mockIsAiTutorEnabled.mockReturnValue(true);
  mockIsRagTutorEnabled.mockReturnValue(false);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue(VALID_USER);
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockRoutedCompletion.mockResolvedValue({
    content: JSON.stringify({
      explanation: "A fraction represents a part of a whole.",
      practicePrompt: "What is 1/4 + 1/4?",
      guidanceLevel: "moderate",
      confidenceScore: 0.9,
    }),
    tier: "smart",
    model: "gpt-4o-mini",
    inputTokens: 100,
    outputTokens: 80,
    estimatedCostUSD: 0.0001,
  });
});

describe("POST /api/student/tutor", () => {
  it("returns 404 when the feature flag is off", async () => {
    mockIsAiTutorEnabled.mockReturnValue(false);

    const response = await POST(makeReq());

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("ai_tutor_disabled");
  });

  it("returns the expected structured response on success", async () => {
    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      explanation: "A fraction represents a part of a whole.",
      practicePrompt: "What is 1/4 + 1/4?",
      guidanceLevel: "moderate",
      hadFallback: false,
    });
    expect(typeof body.confidenceScore).toBe("number");
  });

  it("does not leak student identifiers into the prompt or audit payload", async () => {
    await POST(makeReq());

    const [completionArgs] = mockRoutedCompletion.mock.calls[0];
    const promptText = completionArgs.messages.map((message: any) => message.content).join(" ");
    const [auditArgs] = mockLogAudit.mock.calls[0];

    expect(promptText).not.toContain(VALID_USER.id);
    expect(promptText).not.toContain(VALID_USER.schoolId);
    expect(promptText).toContain("Current lesson subject: Mathematics.");
    expect(promptText).toContain("Current learner level: Grade 6 (upper primary).");
    expect(promptText).toContain("Current lesson title: Adding Fractions.");
    expect(promptText).toContain("Student question: Explain how to add fractions with the same denominator.");
    expect(auditArgs.details).not.toHaveProperty("studentId");
  });

  it("returns the safe hourly-limit error after 20 requests", async () => {
    for (let index = 0; index < 20; index += 1) {
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

  it("returns a graceful fallback when the shared budget guard blocks the request", async () => {
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        explanation:
          "The AI tutor is temporarily unavailable. Please ask your teacher for help with this topic.",
        practicePrompt: null,
        guidanceLevel: "light",
        confidenceScore: 0,
      }),
      tier: "smart",
      model: "budget_guard",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
      budgetBlocked: true,
    });
    const response = await POST(makeReq());
    expect(response.status).toBe(200);
    expect((await response.json()).hadFallback).toBe(true);
  });

  it("falls back safely when the AI call fails", async () => {
    mockRoutedCompletion.mockRejectedValue(new Error("OpenAI unavailable"));

    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hadFallback).toBe(true);
    expect(typeof body.explanation).toBe("string");
    expect(body.explanation.length).toBeGreaterThan(0);
  });
});
