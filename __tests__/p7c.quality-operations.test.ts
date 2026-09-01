import { describe, expect, it } from "vitest";
import { createExposureEvent, type Assignment, type ExperimentDefinition } from "@/lib/experiments/controlledExperiment";
import { evaluateExperimentQuality, type ClusterOutcome, type QualityPolicy, type QualitySnapshot } from "@/lib/experiments/qualityOperations";

const definition: ExperimentDefinition = { experimentId: "p7c-layout", version: 1, metricVersion: 2, name: "Layout", description: "fixture", owner: "quality", status: "RUNNING", unitOfAssignment: "SCHOOL", eligiblePopulation: {}, arms: [{ id: "control", kind: "CONTROL", allocationBps: 5000 }, { id: "treatment", kind: "TREATMENT", allocationBps: 5000 }], controlArm: "control", startAt: "2026-01-01T00:00:00.000Z", endAt: "2027-01-01T00:00:00.000Z", conflictDomains: [], primaryMetrics: ["learning_dosage"], secondaryMetrics: [], guardrails: [{ metricId: "safety_decisions", direction: "MIN", threshold: 0.9 }], earlyStopPolicy: { minimumSample: 2, srmThreshold: 10.827, guardrails: [] }, createdAt: "2026-01-01T00:00:00.000Z" };
const assignment = (id: string, armId: string): Assignment => ({ experimentId: definition.experimentId, experimentVersion: 1, definitionHash: "fixed", algorithmVersion: "fnv1a-v1", schoolId: id, assignmentUnit: "SCHOOL", assignmentId: id, armId, armKind: armId === "control" ? "CONTROL" : "TREATMENT", assignedAt: "2026-06-01T00:00:00.000Z", eligibilityReason: "eligible" });
const assignments = [assignment("school-c1", "control"), assignment("school-c2", "control"), assignment("school-t1", "treatment"), assignment("school-t2", "treatment")];
const exposure = (row: Assignment, extra: Partial<Parameters<typeof createExposureEvent>[0]> = {}) => createExposureEvent({ assignment: row, schoolId: row.schoolId, actorType: "learner", occurredAt: "2026-06-02T00:00:00.000Z", featureKey: "layout", contentVersion: "v1", ...extra });
const outcome = (row: Assignment, value: number | null, extra: Partial<ClusterOutcome> = {}): ClusterOutcome => ({ assignmentId: row.assignmentId, schoolId: row.schoolId, armId: row.armId, metricId: "learning_dosage", metricVersion: 2, definitionVersion: 1, occurredAt: "2026-06-02T00:00:00.000Z", value, source: "production", ...extra });
const policy: QualityPolicy = { evaluatedAt: "2026-06-03T00:00:00.000Z", minimumClustersPerArm: 2, maximumMissingRate: 0.1, maximumLatencyMs: 10 * 24 * 60 * 60 * 1000, maximumFutureSkewMs: 1000, maximumLateMs: 10 * 24 * 60 * 60 * 1000, requireReviewDimensions: ["safety", "helpfulness"], sequentialCheckpoints: ["2026-06-03T00:00:00.000Z"], comparisonCount: 1, minimumDetectableEffect: 0.05 };
const reviews = [{ reviewId: "r1", reviewerId: "quality-reviewer", authorized: true, sampledAt: policy.evaluatedAt, dimension: "safety" as const, outcome: "PASS" as const, evidenceId: "sample-safety" }, { reviewId: "r2", reviewerId: "quality-reviewer", authorized: true, sampledAt: policy.evaluatedAt, dimension: "helpfulness" as const, outcome: "PASS" as const, evidenceId: "sample-help" }];
const snapshot = (overrides: Partial<QualitySnapshot> = {}): QualitySnapshot => ({ snapshotId: "snapshot-1", tenantId: "tenant-a", definition, assignments, exposures: assignments.map((row) => exposure(row)), metricEvents: [], outcomes: [outcome(assignments[0], 0.2), outcome(assignments[1], 0.3), outcome(assignments[2], 0.7), outcome(assignments[3], 0.8)], reviews, ...overrides });

describe("P7-C quality operations", () => {
  it("returns reproducible READY evidence with cluster-aware conclusions", () => {
    const first = evaluateExperimentQuality(snapshot(), policy), second = evaluateExperimentQuality(snapshot(), policy);
    expect(first.state).toBe("READY"); expect(first.evidenceHash).toBe(second.evidenceHash); expect(first.comparisons[0]).toMatchObject({ clusters: 2, conclusion: "POSITIVE" });
  });
  it("does not pseudo-replicate learner outcomes and does not call a zero-crossing interval a success", () => {
    const result = evaluateExperimentQuality(snapshot({ outcomes: [outcome(assignments[0], 0.5), outcome(assignments[1], 0.5), outcome(assignments[2], 0.51), outcome(assignments[3], 0.49)] }), policy);
    expect(result.state).toBe("INSUFFICIENT"); expect(result.comparisons[0]).toMatchObject({ clusters: 2, conclusion: "NEUTRAL" });
  });
  it("detects true SRM but leaves too-small allocation checks insufficient", () => {
    const srmAssignments = Array.from({ length: 12 }, (_, index) => assignment(`school-c${index}`, "control"));
    const srm = evaluateExperimentQuality(snapshot({ assignments: srmAssignments, exposures: [], outcomes: [] }), { ...policy, minimumClustersPerArm: 1, requireReviewDimensions: [] });
    expect(srm.state).toBe("STOPPED"); expect(srm.srm.status).toBe("SRM_DETECTED");
    const small = evaluateExperimentQuality(snapshot({ assignments: [assignment("school-c1", "control")], exposures: [exposure(assignments[0])], outcomes: [outcome(assignments[0], 0.5)] }), { ...policy, minimumClustersPerArm: 1, requireReviewDimensions: [] });
    expect(small.srm.status).toBe("INSUFFICIENT_DATA");
  });
  it("reconciles missing, unassigned, duplicate, replayed, delayed and cross-school evidence fail closed", () => {
    const wrongSchool = { ...exposure(assignments[2]), schoolId: "school-c1" };
    const report = evaluateExperimentQuality(snapshot({ exposures: [exposure(assignments[0]), exposure(assignments[1]), exposure(assignments[2]), exposure(assignments[2]), wrongSchool], outcomes: [outcome(assignments[0], 0.2), outcome(assignments[1], 0.3), outcome(assignments[2], 0.7), outcome(assignments[2], 0.7), outcome(assignments[3], 0.8)] }), policy);
    expect(report.state).toBe("INVALID"); expect(report.reconciliation.duplicates).toBeGreaterThan(0); expect(report.reconciliation.crossSchool).toBe(1); expect(report.reconciliation.assignmentWithoutExposure).toBe(1);
  });
  it("rejects synthetic, malformed, future, late, metric-version and definition-version contamination", () => {
    const report = evaluateExperimentQuality(snapshot({ exposures: [{ nope: true }], outcomes: [outcome(assignments[0], 0.2, { source: "fixture" }), outcome(assignments[1], 0.3, { occurredAt: "2028-01-01T00:00:00.000Z" }), outcome(assignments[2], 0.7, { metricVersion: 1 }), outcome(assignments[3], 0.8, { definitionVersion: 2 })] }), policy);
    expect(report.state).toBe("INVALID"); expect(report.reconciliation.malformed).toBe(1);
  });
  it("requires authorized human samples, governed sequential checkpoints, and recommends stop for guardrail harm", () => {
    const pending = evaluateExperimentQuality(snapshot({ reviews: [{ ...reviews[0], authorized: false }] }), policy);
    expect(pending.state).toBe("PENDING_REVIEW");
    const guardrail = evaluateExperimentQuality(snapshot({ outcomes: [...snapshot().outcomes, outcome(assignments[0], 0.2, { metricId: "safety_decisions", value: 0.2 })] }), policy);
    expect(guardrail.state).toBe("STOPPED"); expect(guardrail.audit.some((record) => record.action === "experiment.quality_stop_recommended")).toBe(true);
    const repeated = evaluateExperimentQuality(snapshot({ priorEvaluationSnapshotIds: ["snapshot-1"] }), policy);
    expect(repeated.state).toBe("PENDING_REVIEW"); expect(repeated.reasons).toContain("repeated_evaluation_snapshot");
  });
});
