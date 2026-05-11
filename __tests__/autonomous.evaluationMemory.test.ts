import { afterEach, describe, expect, it, vi } from "vitest";
import { calibrateConfidence, scoreEvidenceCoverage } from "@/lib/autonomous/evaluation/confidenceCalibrationService";
import { validateMemoryGovernance } from "@/lib/autonomous/memory/memoryGovernanceService";
import { isMemoryExpired } from "@/lib/autonomous/memory/memoryRetentionService";

const mockPrisma = vi.hoisted(() => ({
  agentDecision: { findUnique: vi.fn() },
  workflowRun: { findUnique: vi.fn() },
  actionExecution: { findFirst: vi.fn(), findMany: vi.fn() },
  approvalRequest: { findUnique: vi.fn() },
  masterySnapshot: { findMany: vi.fn() },
  learningEvent: { findMany: vi.fn(), findUnique: vi.fn() },
  executionTrace: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/db/writeThrottle", () => ({ withDbWriteThrottle: (_name: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

const adminUser = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false } as any;
const otherAdmin = { id: "admin-2", role: "ADMIN", schoolId: "school-2", isPlatformAdmin: false } as any;
const moeUser = { id: "moe-1", role: "MOE_OFFICIAL", schoolId: null, isPlatformAdmin: false } as any;

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    workflowRunId: "wf-1",
    decisionType: "detector.recommendation.student-risk",
    riskLevel: "medium",
    confidence: 0.8,
    traceId: "trace-1",
    evidenceRefs: { refs: [{ type: "MasterySnapshot", id: "ms-1", schoolId: "school-1" }] },
    decision: { detectorId: "student-risk", targetType: "student", targetId: "student-1" },
    ...overrides,
  };
}

function workflow(overrides: Record<string, unknown> = {}) {
  return { id: "wf-1", schoolId: "school-1", districtId: null, traceId: "trace-1", targetType: "student", targetId: "student-1", ...overrides };
}

function memoryEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "memory-1",
    eventType: "autonomous.memory.recorded",
    schoolId: "school-1",
    districtId: null,
    targetType: "school",
    targetId: "school-1",
    occurredAt: new Date(),
    metadata: {
      memoryType: "SCHOOL_PATTERN",
      scope: "school",
      summary: "Intervention follow-up works best within one week.",
      confidence: 0.82,
      sensitivity: "tenant",
      lineage: { evaluationEventId: "eval-1" },
      evidenceRefs: { refs: [{ type: "LearningEvent", id: "event-1", schoolId: "school-1" }] },
      retention: { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.ENABLE_AUTONOMOUS_EVALUATION;
  delete process.env.ENABLE_AUTONOMOUS_MEMORY;
  delete process.env.ENABLE_FALSE_POSITIVE_REVIEW;
});

describe("evaluation attribution and calibration", () => {
  it("fails closed when evaluation is disabled", async () => {
    const { evaluateRecommendationOutcome } = await import("@/lib/autonomous/evaluation/evaluationService");
    await expect(evaluateRecommendationOutcome({ agentDecisionId: "decision-1" })).rejects.toMatchObject({
      code: "autonomous_evaluation_disabled",
    });
  });

  it("records deterministic recommendation attribution with lineage", async () => {
    process.env.ENABLE_AUTONOMOUS_EVALUATION = "true";
    mockPrisma.agentDecision.findUnique.mockResolvedValueOnce(decision());
    mockPrisma.workflowRun.findUnique.mockResolvedValueOnce(workflow());
    mockPrisma.actionExecution.findFirst.mockResolvedValueOnce({ id: "action-1", status: "EXECUTED", targetType: "student", targetId: "student-1" });
    mockPrisma.masterySnapshot.findMany.mockResolvedValueOnce([
      { id: "before", masteryScore: 0.4, createdAt: new Date(Date.now() - 10_000) },
      { id: "after", masteryScore: 0.7, createdAt: new Date() },
    ]);
    mockPrisma.executionTrace.create.mockResolvedValueOnce({ id: "trace-row", startedAt: new Date() });
    mockPrisma.executionTrace.findUnique.mockResolvedValueOnce({ id: "trace-row", startedAt: new Date() });
    mockPrisma.executionTrace.update.mockResolvedValueOnce({});
    const { evaluateRecommendationOutcome } = await import("@/lib/autonomous/evaluation/evaluationService");
    const evaluation = await evaluateRecommendationOutcome({ agentDecisionId: "decision-1", actorId: "admin-1" });
    expect(evaluation.outcome).toBe("executed");
    expect(evaluation.lineage).toMatchObject({ actionExecutionId: "action-1" });
    expect(evaluation.confidenceAfter).toBeGreaterThan(0.7);
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "autonomous.evaluation.recorded" }));
  });

  it("calibrates confidence downward for false positives", () => {
    const coverage = scoreEvidenceCoverage({ refs: [{ id: "a", type: "LearningEvent", schoolId: "school-1" }] });
    const calibrated = calibrateConfidence({ confidenceBefore: 0.9, outcome: "false_positive", evidenceCoverageScore: coverage });
    expect(calibrated).toBeLessThan(0.7);
  });
});

describe("memory governance and retrieval", () => {
  it("blocks aggregate memory that includes raw tenant/person scope", () => {
    const result = validateMemoryGovernance({
      memoryType: "NATIONAL_PATTERN",
      scope: "national",
      schoolId: "school-1",
      targetType: "student",
      summary: "Student pattern",
      evidenceRefs: { refs: [{ id: "e1", type: "LearningEvent", scope: "aggregate" }] },
      lineage: { evaluationEventId: "eval-1" },
    });
    expect(result.allowed).toBe(false);
  });

  it("filters tenant memory by requester school and excludes expired records", async () => {
    process.env.ENABLE_AUTONOMOUS_MEMORY = "true";
    mockPrisma.learningEvent.findMany
      .mockResolvedValueOnce([
        memoryEvent(),
        memoryEvent({ id: "memory-2", schoolId: "school-2" }),
        memoryEvent({ id: "memory-3", metadata: { ...memoryEvent().metadata, retention: { expiresAt: new Date(Date.now() - 1000).toISOString() } } }),
      ])
      .mockResolvedValueOnce([memoryEvent()]);
    const { retrieveOperationalMemory } = await import("@/lib/autonomous/memory/memoryRetrievalService");
    const memory = await retrieveOperationalMemory({ requester: adminUser });
    expect(memory).toHaveLength(1);
    expect(memory[0].id).toBe("memory-1");
    await expect(retrieveOperationalMemory({ requester: otherAdmin })).resolves.toHaveLength(0);
  });

  it("allows MOE users to retrieve aggregate memory only", async () => {
    process.env.ENABLE_AUTONOMOUS_MEMORY = "true";
    mockPrisma.learningEvent.findMany.mockResolvedValueOnce([
      memoryEvent({ id: "national-1", schoolId: null, districtId: null, metadata: { ...memoryEvent().metadata, memoryType: "NATIONAL_PATTERN", scope: "national", sensitivity: "aggregate" } }),
    ]);
    const { retrieveOperationalMemory } = await import("@/lib/autonomous/memory/memoryRetrievalService");
    const memory = await retrieveOperationalMemory({ requester: moeUser, aggregateOnly: true, memoryTypes: ["NATIONAL_PATTERN"] });
    expect(memory).toHaveLength(1);
    expect(memory[0].schoolId).toBeNull();
  });

  it("tracks memory lineage from append-only LearningEvent records", async () => {
    mockPrisma.learningEvent.findUnique.mockResolvedValueOnce(memoryEvent());
    const { getMemoryLineage } = await import("@/lib/autonomous/memory/memoryLineageService");
    const lineage = await getMemoryLineage("memory-1");
    expect(lineage.evidenceRefs).toMatchObject({ refs: expect.any(Array) });
    expect(lineage.lineage).toMatchObject({ evaluationEventId: "eval-1" });
  });

  it("enforces retention expiration deterministically", () => {
    expect(isMemoryExpired({ retention: { expiresAt: new Date(Date.now() - 1000).toISOString() } })).toBe(true);
  });
});
