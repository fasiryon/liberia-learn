import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsAdaptiveEngineEnabled = vi.hoisted(() => vi.fn());
const mockGetAiBudgetMonthlyCap = vi.hoisted(() => vi.fn());
const mockDetectMasteryGaps = vi.hoisted(() => vi.fn());
const mockComputeDifficultyTier = vi.hoisted(() => vi.fn());
const mockGenerateTargetedPracticeWithUsage = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRecordMetricEvent = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockAdaptiveAttemptFindMany = vi.hoisted(() => vi.fn());
const mockAiInteractionLogAggregate = vi.hoisted(() => vi.fn());
const mockAiInteractionLogCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/serverFlags", () => ({
  isAdaptiveEngineEnabled: mockIsAdaptiveEngineEnabled,
  getAiBudgetMonthlyCap: mockGetAiBudgetMonthlyCap,
}));
vi.mock("@/lib/adaptive/gapDetector", () => ({ detectMasteryGaps: mockDetectMasteryGaps }));
vi.mock("@/lib/adaptive/difficultyAdapter", () => ({ computeDifficultyTier: mockComputeDifficultyTier }));
vi.mock("@/lib/adaptive/practiceGenerator", () => ({
  generateTargetedPracticeWithUsage: mockGenerateTargetedPracticeWithUsage,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    studentAdaptiveAttempt: { findMany: mockAdaptiveAttemptFindMany },
    aiInteractionLog: {
      aggregate: mockAiInteractionLogAggregate,
      create: mockAiInteractionLogCreate,
    },
  },
}));

import { POST } from "@/app/api/student/adaptive/practice/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/student/adaptive/practice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdaptiveEngineEnabled.mockReturnValue(true);
  mockGetAiBudgetMonthlyCap.mockReturnValue(100);
  mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
  mockStudentFindFirst.mockResolvedValue({ id: "student-1" });
  mockAiInteractionLogAggregate.mockResolvedValue({ _sum: { estimatedCostUSD: 0 } });
  mockAdaptiveAttemptFindMany.mockResolvedValue([]);
  mockDetectMasteryGaps.mockResolvedValue([
    {
      strand: "fractions",
      subject: "MATH",
      grade: 6,
      averageScore: 0.45,
      attemptCount: 2,
      lastAttemptAt: new Date("2026-03-10T00:00:00.000Z"),
    },
  ]);
  mockComputeDifficultyTier.mockReturnValue("standard");
  mockGenerateTargetedPracticeWithUsage.mockResolvedValue({
    practice: {
      strand: "fractions",
      difficultyTier: "standard",
      generatedAt: new Date("2026-03-13T00:00:00.000Z"),
      questions: Array.from({ length: 5 }, (_, index) => ({
        id: `q-${index + 1}`,
        prompt: `Question ${index + 1}`,
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Because",
        hintText: "Think again",
      })),
    },
    estimatedCostUSD: 0.01,
  });
  mockAiInteractionLogCreate.mockResolvedValue({ id: "log-1" });
  mockLogAudit.mockResolvedValue(undefined);
  mockRecordMetricEvent.mockResolvedValue(undefined);
});

describe("POST /api/student/adaptive/practice", () => {
  it("returns 404 when no gap found for strandCode", async () => {
    const response = await POST(makeRequest({ strandCode: "geometry" }));
    expect(response.status).toBe(404);
  });

  it("returns practice set with 5 questions", async () => {
    const response = await POST(makeRequest({ strandCode: "fractions" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.practice.questions).toHaveLength(5);
  });

  it("requires STUDENT session (401 if missing)", async () => {
    mockRequireRole.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    const response = await POST(makeRequest({ strandCode: "fractions" }));
    expect(response.status).toBe(401);
  });

  it("returns 404 when ENABLE_ADAPTIVE_ENGINE is false", async () => {
    mockIsAdaptiveEngineEnabled.mockReturnValue(false);
    const response = await POST(makeRequest({ strandCode: "fractions" }));
    expect(response.status).toBe(404);
  });
});
