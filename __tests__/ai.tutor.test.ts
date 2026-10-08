import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStateForTests } from "@/lib/rateLimit";

const mockResolveTutorContext = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/tutor/tutorContext", async () => {
  const actual = await vi.importActual<any>("@/lib/ai/tutor/tutorContext");
  return { ...actual, resolveTutorContext: mockResolveTutorContext };
});
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: vi.fn() }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mockRoutedCompletion }));
const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAiTutorEnabled = vi.hoisted(() => vi.fn());
const mockIsRagTutorEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockModerateText = vi.hoisted(() => vi.fn());
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
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mockModerateText }));
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
  mockResolveTutorContext.mockResolvedValue({
    contractVersion: "tutor-context/2", schoolId: VALID_USER.schoolId, learnerScopeKey: "opaque", grade: 6, subject: "MATH",
    lesson: { id: "lesson-row", contentId: "adding-fractions", version: "1", revisionId: null, title: "Adding Fractions" },
    unitId: null, releaseId: null, experienceId: null, experienceVersion: null, sceneId: null, objectiveIds: ["fractions.adding"],
    objectiveStatements: ["Add fractions with the same denominator"], allowedRelatedContentIds: [], action: "explain", sourcePolicy: "LEARNER_PROJECTED_LESSONS_ONLY",
    groundingStrength: "STRONG", fingerprint: "test-context", sources: [{ id: "source-1", sourceId: "lesson-row", title: "Adding Fractions", content: "Fractions represent parts of a whole. Add numerators and keep the denominator.",
      sourceType: "lesson", chunkIndex: 0, subject: "MATH", grade: 6, schoolId: null, scope: "GLOBAL", sourceLabel: "Current lesson", similarity: 0, rankingScore: 0, tutorTier: 0 }],
  });
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
  mockModerateText.mockResolvedValue({ verdict: "SAFE" });
  mockRoutedCompletion.mockResolvedValue({
    content: JSON.stringify({
      answer: "A fraction represents a part of a whole.",
      sourceIds: ["source-1"],
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
      practicePrompt: null,
      guidanceLevel: "light",
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
    expect(promptText).toContain("Current objectives:");
    expect(promptText).toContain("Add fractions with the same denominator");
    expect(promptText).toContain("Current lesson: Adding Fractions.");
    expect(promptText).toContain("Explain how to add fractions with the same denominator.");
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

  it("does not call the tutor model when minor input moderation is not SAFE", async () => {
    mockModerateText.mockResolvedValueOnce({ verdict: "UNCERTAIN", reason: "provider_down" });

    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hadFallback).toBe(true);
    expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });

  it("does not expose model output when minor output moderation is not SAFE", async () => {
    mockModerateText
      .mockResolvedValue({ verdict: "UNCERTAIN" })
      .mockResolvedValueOnce({ verdict: "SAFE" })
      .mockResolvedValueOnce({ verdict: "UNCERTAIN", reason: "provider_down" });

    const response = await POST(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.hadFallback).toBe(true);
    expect(body.explanation).not.toContain("A fraction represents");
  });
  it("resolves identifiers and ignores client-supplied lesson text, grade and mastery", async () => {
    await POST(makeReq({ ...VALID_BODY, tutorContext: { contentId: "adding-fractions", lessonVersion: "1" }, lessonContent: "FORGED AUTHORITY", masteryState: "MASTERED", sourceIds: ["foreign"], gradeLevel: 12 }));
    expect(mockResolveTutorContext).toHaveBeenCalledWith(VALID_USER, { contentId: "adding-fractions", lessonVersion: "1" }, "explain");
    expect(JSON.stringify(mockRoutedCompletion.mock.calls[0][0].messages)).not.toContain("FORGED AUTHORITY");
    expect(JSON.stringify(mockRoutedCompletion.mock.calls[0][0].messages)).not.toContain("MASTERED");
  });
  it("preserves canonical authorization rejection without invoking the model", async () => {
    mockResolveTutorContext.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    const response = await POST(makeReq());
    expect(response.status).toBe(404); expect(mockRoutedCompletion).not.toHaveBeenCalled();
  });
  it("rejects oversized identity or questions", async () => {
    const response = await POST(makeReq({ question: "x".repeat(1201) }));
    expect(response.status).toBe(400); expect(mockResolveTutorContext).not.toHaveBeenCalled();
  });

});
