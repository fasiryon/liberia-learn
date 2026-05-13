import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  learningEvent: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
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
  isAutonomousMemoryEnabled: () => process.env.ENABLE_AUTONOMOUS_MEMORY === "true",
}));

const range = {
  from: new Date("2026-05-01T00:00:00.000Z"),
  to: new Date("2026-05-31T23:59:59.999Z"),
};

function learningEvent(id: string, eventType: string, occurredAt = "2026-05-28T10:00:00.000Z", overrides: Record<string, unknown> = {}) {
  return {
    id,
    eventType,
    schoolId: "school-1",
    districtId: "district-1",
    classId: "class-1",
    studentId: "student-1",
    userId: "user-1",
    occurredAt: new Date(occurredAt),
    metadata: { studentName: "Should Not Leak", eventType },
    ...overrides,
  };
}

function resetMocks(events: any[] = []) {
  mockPrisma.learningEvent.findMany.mockImplementation((args: any) => {
    const eventType = args?.where?.eventType;
    if (eventType === "autonomous.memory.recorded") return Promise.resolve([]);
    if (eventType?.in?.includes?.("autonomous.evaluation.recorded")) return Promise.resolve([]);
    if (eventType?.in && eventType.in.includes("report_card.generated")) return Promise.resolve(events);
    if (eventType === "predictive.forecast.outcome_recorded") return Promise.resolve([]);
    return Promise.resolve(events);
  });
  mockPrisma.learningEvent.create.mockResolvedValue({ id: "prediction-outcome-event" });
  mockPrisma.agentDecision.findMany.mockResolvedValue([
    { id: "decision-1", decisionType: "detector.recommendation.student_risk", evidenceRefs: { refs: [{ type: "LearningEvent", id: "e1", schoolId: "school-1" }] } },
  ]);
  mockPrisma.workflowRun.findMany.mockResolvedValue([]);
  mockRequireUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false });
  mockLogAudit.mockResolvedValue(undefined);
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_PREDICTIVE_INTELLIGENCE;
  delete process.env.ENABLE_AUTONOMOUS_MEMORY;
});

describe("Autonomous OS Phase 14 predictive intelligence", () => {
  it("generates explainable predictive evidence without raw PII leakage", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks([
      learningEvent("e1", "assignment.submitted", "2026-05-20T10:00:00.000Z"),
      learningEvent("e2", "assignment.submitted", "2026-05-28T10:00:00.000Z"),
      learningEvent("e3", "attendance.updated", "2026-05-29T10:00:00.000Z"),
      learningEvent("e4", "lesson.completed", "2026-05-30T10:00:00.000Z"),
    ]);

    const { getPredictiveIntelligence } = await import("@/lib/autonomous/predictions/predictiveIntelligenceService");
    const result = await getPredictiveIntelligence({ scope: { schoolId: "school-1" }, range, types: ["student_risk"] });

    expect(result.enabled).toBe(true);
    expect(result.forecasts[0].evidenceRefs.some((ref) => ref.type === "LearningEvent")).toBe(true);
    expect(JSON.stringify(result.forecasts)).not.toContain("Should Not Leak");
    expect(result.forecasts[0].recommendedActions.join(" ")).toContain("review");
  });

  it("degrades confidence and warns on sparse stale signals", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks([learningEvent("old-1", "lesson.started", "2026-05-01T10:00:00.000Z")]);

    const { getPredictiveIntelligence } = await import("@/lib/autonomous/predictions/predictiveIntelligenceService");
    const result = await getPredictiveIntelligence({ scope: { schoolId: "school-1" }, range, types: ["student_risk"] });

    expect(result.forecasts[0].confidenceBand).toBe("LOW");
    expect(result.forecasts[0].warnings.join(" ")).toContain("Signals are stale");
  });

  it("suppresses school and student identifiers for aggregate-safe forecasting", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks([learningEvent("agg-1", "guardian.report_card.viewed")]);

    const { getPredictiveIntelligence } = await import("@/lib/autonomous/predictions/predictiveIntelligenceService");
    const result = await getPredictiveIntelligence({ scope: { aggregateSafe: true }, range, types: ["district_national_aggregate"] });

    expect(result.forecasts[0].aggregateSafe).toBe(true);
    expect(result.forecasts[0].schoolId).toBeNull();
    expect(result.forecasts[0].targetId).toBeNull();
    expect(JSON.stringify(result.forecasts[0])).not.toContain("student-1");
  });

  it("classifies deteriorating and unknown trajectories deterministically", async () => {
    const { classifyTrajectory } = await import("@/lib/autonomous/predictions/riskTrajectoryService");
    expect(classifyTrajectory([{ key: "a", label: "A", direction: "negative", score: 80, evidence: [] }])).toBe("deteriorating");
    expect(classifyTrajectory([{ key: "m", label: "Missing", direction: "missing", score: 0, evidence: [] }])).toBe("unknown");
  });

  it("records forecast outcomes through append-only LearningEvent tracking", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks();

    const { recordForecastOutcome } = await import("@/lib/autonomous/predictions/forecastingTraceService");
    const result = await recordForecastOutcome({
      forecastId: "forecast-1",
      forecastType: "student_risk",
      outcome: "false_positive",
      schoolId: "school-1",
      actorId: "admin-1",
      notes: "Raw notes should not be stored",
      confidenceBefore: 0.8,
      evidenceRefs: [{ type: "LearningEvent", id: "e1", schoolId: "school-1" }],
    });

    expect(result.confidenceAfter).toBeLessThan(0.8);
    const createArgs = mockPrisma.learningEvent.create.mock.calls[0][0].data;
    expect(createArgs.eventType).toBe("predictive.forecast.outcome_recorded");
    expect(createArgs.metadata.notes).toBeUndefined();
    expect(createArgs.metadata.notesLength).toBeGreaterThan(0);
  });

  it("enforces tenant scope for school-admin prediction API reads", async () => {
    process.env.ENABLE_PREDICTIVE_INTELLIGENCE = "true";
    resetMocks([learningEvent("e1", "lesson.completed")]);

    const { GET } = await import("@/app/api/admin/ops/predictions/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/ops/predictions"));

    expect(response.status).toBe(200);
    expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ schoolId: "school-1" }),
    }));
  });

  it("returns disabled behavior when the feature flag is off", async () => {
    resetMocks([learningEvent("e1", "lesson.completed")]);

    const { getPredictiveIntelligence } = await import("@/lib/autonomous/predictions/predictiveIntelligenceService");
    const result = await getPredictiveIntelligence({ scope: { schoolId: "school-1" }, range });

    expect(result.enabled).toBe(false);
    expect(result.forecasts).toEqual([]);
  });
});
