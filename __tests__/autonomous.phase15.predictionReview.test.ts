import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  learningEvent: { findMany: vi.fn(), create: vi.fn() },
  agentDecision: { findMany: vi.fn() },
  workflowRun: { findMany: vi.fn() },
}));
const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/serverFlags", () => ({
  isPredictiveIntelligenceEnabled: () => process.env.ENABLE_PREDICTIVE_INTELLIGENCE === "true",
  isPredictionReviewWorkflowEnabled: () => process.env.ENABLE_PREDICTIVE_INTELLIGENCE === "true" && process.env.ENABLE_PREDICTION_REVIEW_WORKFLOW !== "false",
  isAutonomousMemoryEnabled: () => false,
}));

const range = { from: new Date("2026-05-01T00:00:00.000Z"), to: new Date("2026-05-31T23:59:59.999Z") };

function productEvent(id: string, eventType: string, occurredAt = "2026-05-28T10:00:00.000Z") {
  return { id, eventType, schoolId: "school-1", districtId: "district-1", studentId: "student-1", occurredAt: new Date(occurredAt), metadata: {} };
}

function reviewEvent(forecastId: string, decision = "escalated") {
  return {
    id: `review-${forecastId}`,
    schoolId: "school-1",
    targetId: forecastId,
    status: decision,
    occurredAt: new Date("2026-05-29T10:00:00.000Z"),
    metadata: { forecastId, forecastType: "student_risk", decision, rationaleLength: 19 },
  };
}

function outcomeEvent(forecastId: string, outcome = "false_positive") {
  return {
    id: `outcome-${forecastId}`,
    schoolId: "school-1",
    targetId: forecastId,
    status: outcome,
    occurredAt: new Date("2026-05-30T10:00:00.000Z"),
    metadata: { forecastId, forecastType: "student_risk", outcome, confidenceBefore: 0.8, confidenceAfter: 0.54 },
  };
}

function resetMocks(options: { products?: any[]; reviews?: any[]; outcomes?: any[] } = {}) {
  const products = options.products ?? [
    productEvent("e1", "assignment.submitted"),
    productEvent("e2", "assignment.submitted"),
    productEvent("e3", "lesson.started"),
  ];
  const reviews = options.reviews ?? [];
  const outcomes = options.outcomes ?? [];
  mockPrisma.learningEvent.findMany.mockImplementation((args: any) => {
    const eventType = args?.where?.eventType;
    if (eventType === "predictive.forecast.review_recorded") return Promise.resolve(reviews);
    if (eventType === "predictive.forecast.outcome_recorded") return Promise.resolve(outcomes);
    if (eventType === "autonomous.memory.recorded") return Promise.resolve([]);
    if (eventType?.in?.includes?.("autonomous.evaluation.recorded")) return Promise.resolve(outcomes);
    return Promise.resolve(products);
  });
  mockPrisma.learningEvent.create.mockResolvedValue({ id: "created-event" });
  mockPrisma.agentDecision.findMany.mockResolvedValue([]);
  mockPrisma.workflowRun.findMany.mockResolvedValue([]);
  mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false });
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_PREDICTIVE_INTELLIGENCE;
  delete process.env.ENABLE_PREDICTION_REVIEW_WORKFLOW;
});

describe("Autonomous OS Phase 15 prediction review workflow", () => {
  it("enriches early warnings with latest review and outcome state", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    const forecastId = "student_risk:school-1:2026-05-01:2026-05-31";
    resetMocks({ reviews: [reviewEvent(forecastId)], outcomes: [outcomeEvent(forecastId)] });

    const { getPredictionReviewQueue } = await import("@/lib/autonomous/predictions/predictionReviewService");
    const queue = await getPredictionReviewQueue({ scope: { schoolId: "school-1" }, range });

    expect(queue.enabled).toBe(true);
    expect(queue.items.some((item: any) => item.reviewState === "escalated")).toBe(true);
    expect(queue.items.some((item: any) => item.outcomeState === "false_positive")).toBe(true);
    expect(queue.analytics?.outcomesRecorded).toBeGreaterThan(0);
  });

  it("records human prediction reviews without storing raw rationale", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks();

    const { recordPredictionReview } = await import("@/lib/autonomous/predictions/predictionReviewService");
    await recordPredictionReview({
      forecastId: "forecast-1",
      forecastType: "student_risk",
      decision: "needs_more_data",
      schoolId: "school-1",
      actorId: "admin-1",
      rationale: "Student name and sensitive text should not be stored",
    });

    const data = mockPrisma.learningEvent.create.mock.calls[0][0].data;
    expect(data.eventType).toBe("predictive.forecast.review_recorded");
    expect(data.metadata.decision).toBe("needs_more_data");
    expect(data.metadata.rationale).toBeUndefined();
    expect(data.metadata.rationaleLength).toBeGreaterThan(0);
    expect(data.qualityMarkers.noAutonomousAction).toBe(true);
  });

  it("computes calibration analytics from explicit outcome feedback", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks({
      outcomes: [
        outcomeEvent("f1", "accurate"),
        outcomeEvent("f2", "false_positive"),
        outcomeEvent("f3", "missed_risk"),
      ],
    });

    const { getForecastCalibrationDashboard } = await import("@/lib/autonomous/predictions/forecastCalibrationDashboardService");
    const dashboard = await getForecastCalibrationDashboard({ scope: { schoolId: "school-1" }, range });

    expect(dashboard.analytics?.totalOutcomes).toBe(3);
    expect(dashboard.analytics?.falsePositiveRate).toBeCloseTo(0.333, 3);
    expect(dashboard.byType[0].forecastType).toBe("student_risk");
  });

  it("prediction review API enforces school tenant scope", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks();

    const { GET } = await import("@/app/api/admin/ops/prediction-reviews/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/ops/prediction-reviews"));

    expect(response.status).toBe(200);
    expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
  });

  it("fails closed when prediction review workflow is disabled", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    process.env.ENABLE_PREDICTION_REVIEW_WORKFLOW = "false";
    resetMocks();

    const { getPredictionReviewQueue } = await import("@/lib/autonomous/predictions/predictionReviewService");
    const queue = await getPredictionReviewQueue({ scope: { schoolId: "school-1" }, range });

    expect(queue.enabled).toBe(false);
    expect(queue.items).toEqual([]);
  });
});
