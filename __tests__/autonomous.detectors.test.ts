import { afterEach, describe, expect, it, vi } from "vitest";
import { detectorRegistry, getDetector, listDetectors } from "@/lib/autonomous/detectors/detectorRegistry";
import { assertTenantSafeEvidence } from "@/lib/autonomous/detectors/detectorEvidenceResolver";
import {
  buildRecommendationIdempotencyKey,
  buildRecommendationPayload,
  createDetectorRecommendations,
} from "@/lib/autonomous/detectors/detectorRecommendationEngine";
import { confidenceBand, scoreDetectorSignals } from "@/lib/autonomous/detectors/recommendationScoringService";
import type { DetectionFinding, DetectorContext, DetectorEvidence } from "@/lib/autonomous/detectors/types";

const mockAgentDecisionUpsert = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentDecision: { upsert: mockAgentDecisionUpsert },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: mockLogLearningEvent }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

function evidence(overrides: Partial<DetectorEvidence> = {}): DetectorEvidence {
  return {
    tenantId: "school-1",
    schoolId: "school-1",
    targetType: "student",
    targetId: "student-1",
    windowKey: "2026-05",
    signals: [
      {
        key: "masteryCollapsePct",
        value: -22,
        threshold: 15,
        direction: "decline",
        weight: 4,
        label: "Mastery decline",
        evidence: [{ type: "MasterySnapshot", id: "snapshot-1", schoolId: "school-1" }],
      },
      {
        key: "failedAssessmentCount",
        value: 3,
        threshold: 2,
        direction: "above",
        weight: 3,
        label: "Repeated failures",
        evidence: [{ type: "AssessmentAttempt", id: "attempt-1", schoolId: "school-1" }],
      },
    ],
    ...overrides,
  };
}

function finding(overrides: Partial<DetectionFinding> = {}): DetectionFinding {
  const detector = getDetector("student-risk");
  return detector.detect(evidence())[0] ?? {
    findingType: "mastery_collapse",
    title: "Review mastery collapse",
    severity: "medium",
    confidence: 0.8,
    riskLevel: "low",
    explanation: "Deterministic test finding",
    evidence: [{ type: "MasterySnapshot", id: "snapshot-1", schoolId: "school-1" }],
    signals: evidence().signals,
    recommendation: {
      title: "Review mastery collapse",
      summary: "Review recent risk signals.",
      suggestedActions: ["Teacher review"],
      approvalRequired: true,
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_DETECTOR_RECOMMENDATIONS;
});

describe("Autonomous OS Phase 2 detector registry", () => {
  it("registers all requested recommend-only detector types", () => {
    expect(Object.keys(detectorRegistry).sort()).toEqual([
      "curriculum-gap",
      "guardian-communication",
      "moe-governance",
      "national-trend",
      "school-compliance",
      "student-risk",
      "teacher-support",
    ]);
    expect(listDetectors().every((detector) => detector.forbiddenActions.includes("message.send"))).toBe(true);
    expect(getDetector("national-trend").allowedTenantScopes).toEqual(["national_aggregate"]);
  });

  it("triggers student risk findings from deterministic evidence only", () => {
    const findings = getDetector("student-risk").detect(evidence());
    expect(findings).toHaveLength(1);
    expect(findings[0].findingType).toBe("mastery_collapse");
    expect(findings[0].recommendation.approvalRequired).toBe(true);
    expect(findings[0].explanation).toContain("Confidence band");
  });

  it("does not trigger when evidence stays below deterministic thresholds", () => {
    const findings = getDetector("student-risk").detect(
      evidence({
        signals: evidence().signals.map((signal) => ({
          ...signal,
          value: signal.direction === "decline" ? -1 : 0,
        })),
      })
    );
    expect(findings).toHaveLength(0);
  });
});

describe("detector evidence and confidence", () => {
  it("scores confidence from weighted evidence coverage", () => {
    const scored = scoreDetectorSignals(evidence().signals);
    expect(scored.triggeredSignals).toHaveLength(2);
    expect(scored.confidence).toBeGreaterThanOrEqual(0.95);
    expect(confidenceBand(scored.confidence)).toBe("high");
  });

  it("blocks cross-school evidence aggregation", () => {
    const context: DetectorContext = { schoolId: "school-1", targetType: "student", targetId: "student-1" };
    expect(() => assertTenantSafeEvidence(context, evidence({ schoolId: "school-2" }))).toThrow(/tenant boundary/);
  });

  it("requires aggregate scope when no school boundary is present", () => {
    const context: DetectorContext = { targetType: "student", targetId: "student-1" };
    expect(() => assertTenantSafeEvidence(context, evidence({ schoolId: null }))).toThrow(/requires school/);
  });
});

describe("detector recommendations", () => {
  it("skips recommendation writes when the feature flag is disabled", async () => {
    const result = await createDetectorRecommendations([
      {
        workflowRunId: "wf-1",
        detectorId: "student-risk",
        targetType: "student",
        targetId: "student-1",
        windowKey: "2026-05",
        schoolId: "school-1",
        finding: finding(),
      },
    ]);
    expect(result.created).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("feature_flag_disabled");
    expect(mockAgentDecisionUpsert).not.toHaveBeenCalled();
  });

  it("records recommendation lineage, evidence refs, confidence, audit, and approval gating", async () => {
    process.env.ENABLE_DETECTOR_RECOMMENDATIONS = "true";
    mockAgentDecisionUpsert.mockResolvedValue({ id: "decision-1" });

    await createDetectorRecommendations([
      {
        workflowRunId: "wf-1",
        agentRunId: "agent-run-1",
        detectorId: "student-risk",
        targetType: "student",
        targetId: "student-1",
        windowKey: "2026-05",
        schoolId: "school-1",
        traceId: "trace-1",
        finding: finding(),
      },
    ]);

    expect(mockAgentDecisionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          workflowRunId: "wf-1",
          agentRunId: "agent-run-1",
          decisionType: "detector.recommendation.student-risk",
          requiresApproval: true,
          confidence: expect.any(Number),
          evidenceRefs: expect.objectContaining({ refs: expect.any(Array), signals: expect.any(Array) }),
          decision: expect.objectContaining({
            recommendationOnly: true,
            forbiddenExecution: true,
            lineage: expect.objectContaining({ workflowRunId: "wf-1", agentRunId: "agent-run-1" }),
          }),
        }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "action.proposed" }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "detector.recommendation.proposed" }));
  });

  it("uses stable idempotency keys to avoid duplicate recommendation generation", () => {
    const keyA = buildRecommendationIdempotencyKey({
      detectorId: "student-risk",
      targetType: "student",
      targetId: "student-1",
      schoolId: "school-1",
      windowKey: "2026-05",
      findingType: "mastery_collapse",
    });
    const keyB = buildRecommendationIdempotencyKey({
      detectorId: "student-risk",
      targetType: "student",
      targetId: "student-1",
      schoolId: "school-1",
      windowKey: "2026-05",
      findingType: "mastery_collapse",
    });
    expect(keyA).toBe(keyB);
  });

  it("marks replay lineage without enabling action execution", () => {
    const payload = buildRecommendationPayload({
      workflowRunId: "wf-replay",
      agentRunId: "agent-replay",
      detectorId: "student-risk",
      targetType: "student",
      targetId: "student-1",
      windowKey: "2026-05",
      finding: finding(),
      isReplay: true,
    });
    expect(payload.recommendationOnly).toBe(true);
    expect(payload.forbiddenExecution).toBe(true);
    expect((payload.lineage as any).isReplay).toBe(true);
  });
});
