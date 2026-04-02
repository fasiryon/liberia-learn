import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStateForTests } from "@/lib/rateLimit";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsAiTutorEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap = vi.hoisted(() => vi.fn());
const mockRoutedCompletion = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({
  isAiTutorEnabled: mockIsAiTutorEnabled,
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

import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { POST as studentTutorPost } from "@/app/api/student/tutor/route";

describe("AI rate limiting", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRateLimitStateForTests();
    mockRequireUser.mockResolvedValue({
      id: "student-rl-1",
      role: "STUDENT",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });
    mockIsAiTutorEnabled.mockReturnValue(true);
    mockGetAiBudgetMonthlyCap.mockReturnValue(100);
    mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
    mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockRoutedCompletion.mockResolvedValue({
      content: JSON.stringify({
        explanation: "A fraction is part of a whole.",
        practicePrompt: "What is 1/2 of 8?",
        guidanceLevel: "moderate",
        confidenceScore: 0.8,
      }),
      tier: "smart",
      model: "gpt-4o-mini",
      inputTokens: 10,
      outputTokens: 8,
      estimatedCostUSD: 0.0001,
    });
  });

  it("enforces role-based hourly limits through the shared rate limiter", async () => {
    for (let index = 0; index < 20; index += 1) {
      expect(
        (await checkAiRateLimit({
          userId: "student-helper",
          role: "STUDENT",
          endpoint: "/api/student/tutor",
        })).allowed
      ).toBe(true);
    }
    expect(
      (await checkAiRateLimit({
        userId: "student-helper",
        role: "STUDENT",
        endpoint: "/api/student/tutor",
      })).allowed
    ).toBe(false);

    expect(
      (await checkAiRateLimit({
        userId: "teacher-helper",
        role: "TEACHER",
        endpoint: "/api/teacher/assist",
      })).allowed
    ).toBe(true);
    expect(
      (await checkAiRateLimit({
        userId: "admin-helper",
        role: "ADMIN",
        endpoint: "/api/admin/exams/generate",
      })).allowed
    ).toBe(true);
    expect(
      (await checkAiRateLimit({
        userId: "district-helper",
        role: "DISTRICT_ADMIN",
        endpoint: "/api/rag/query",
      })).allowed
    ).toBe(true);
  });

  it("returns the safe error message when the student hourly limit is exceeded", async () => {
    const makeRequest = () =>
      new Request("http://localhost/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Mathematics",
          strandKey: "fractions.adding",
          masteryState: "DEVELOPING",
          proficiencyState: "BELOW_PROFICIENT",
          gradeBand: "upper_primary",
          requestType: "explain",
        }),
      }) as any;

    for (let index = 0; index < 20; index += 1) {
      const response = await studentTutorPost(makeRequest());
      expect(response.status).toBe(200);
    }

    const blocked = await studentTutorPost(makeRequest());
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({
      error: "Too many requests",
      retryAfter: expect.any(Number),
    });
  });
});
