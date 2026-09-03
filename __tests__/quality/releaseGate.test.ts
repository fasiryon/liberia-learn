import { describe, expect, it } from "vitest";
import { evaluateReleaseGate, type ReleaseGateDefinition } from "@/lib/quality/releaseGate";
import type { QualityReport } from "@/lib/experiments/qualityOperations";

const readyReport: QualityReport = { state: "READY", evidenceHash: "h1", reasons: [], reconciliation: { assigned: 4, exposed: 4, assignmentWithoutExposure: 0, exposureWithoutAssignment: 0, duplicates: 0, malformed: 0, crossSchool: 0 }, freshness: { late: 0, futureDated: 0, outOfWindow: 0, missingOutcomes: 0, missingRate: 0, maximumLatencyMs: 0 }, srm: { status: "NORMAL", total: 4, chiSquare: 0, threshold: 3.84, observed: {} }, comparisons: [{ armId: "treatment", clusters: 2, difference: 0.1, confidenceInterval95: [0.01, 0.19], conclusion: "POSITIVE" }], reviews: { required: [], missing: [], unauthorized: 0, failures: 0 }, audit: [] };
const definition: ReleaseGateDefinition = { gateId: "layout-release", version: 1, scope: "experiment", requiredMetricIds: ["learning_dosage"], requiredReviewDomains: ["TUTOR_HELPFULNESS"], minimumSamples: 2, blockingSeverities: ["CRITICAL"], owner: "quality-team" };

describe("release gate", () => {
  it("passes when quality is READY, no fixture failures, and required reviews passed", () => {
    const result = evaluateReleaseGate(definition, readyReport, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("PASS");
  });

  it("blocks on any critical regression fixture failure regardless of average metric", () => {
    const result = evaluateReleaseGate(definition, readyReport, ["regr-cross-school-grading-idor"], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("BLOCK");
    expect(result.rollbackRecommended).toBe(true);
  });

  it("blocks when a review reaches a configured blocking severity", () => {
    const result = evaluateReleaseGate(definition, readyReport, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "FAIL", severity: "CRITICAL" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("BLOCK");
    expect(result.rollbackRecommended).toBe(true);
    expect(result.reasons).toContain("review_blocking_severity:TUTOR_HELPFULNESS:CRITICAL");
  });

  it("returns INSUFFICIENT_EVIDENCE rather than PASS when quality state is INSUFFICIENT", () => {
    const result = evaluateReleaseGate(definition, { ...readyReport, state: "INSUFFICIENT" }, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("does not let primary-metric improvement hide guardrail harm (STOPPED quality state blocks)", () => {
    const result = evaluateReleaseGate(definition, { ...readyReport, state: "STOPPED", reasons: ["guardrail_breach"] }, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("BLOCK");
    expect(result.rollbackRecommended).toBe(true);
  });

  it("warns, not blocks, when a required review domain is missing but nothing failed", () => {
    const result = evaluateReleaseGate(definition, readyReport, [], [], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("WARN");
  });

  it("labels a present-but-failed required review as review_failed, not review_missing", () => {
    const result = evaluateReleaseGate(definition, readyReport, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "FAIL" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("WARN");
    expect(result.reasons).toContain("review_failed:TUTOR_HELPFULNESS");
    expect(result.reasons).not.toContain("review_missing:TUTOR_HELPFULNESS");
  });

  it("warns when quality state is DEGRADED with no other issues (freshness/latency concerns prevent pass)", () => {
    const result = evaluateReleaseGate(definition, { ...readyReport, state: "DEGRADED" }, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("WARN");
    expect(result.rollbackRecommended).toBe(false);
  });

  it("warns when quality state is PENDING_REVIEW with no other issues (human review not yet authorized)", () => {
    const result = evaluateReleaseGate(definition, { ...readyReport, state: "PENDING_REVIEW" }, [], [{ domain: "TUTOR_HELPFULNESS", outcome: "PASS" }], "2026-09-01T00:00:00.000Z");
    expect(result.result).toBe("WARN");
    expect(result.rollbackRecommended).toBe(false);
  });
});
