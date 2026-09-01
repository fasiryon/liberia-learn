import { createHash } from "crypto";
import { ingestGovernedEvents, type GovernedEvent, type MeasurementFamily } from "@/lib/measurement/governedMeasurement";
import { detectSampleRatioMismatch, validateExperimentDefinition, type Assignment, type ExperimentDefinition } from "@/lib/experiments/controlledExperiment";

/**
 * P7-C is deliberately a pure, read-only evaluator.  A caller supplies an
 * immutable evidence snapshot and persists the returned audit records through
 * the established AuditLog architecture.  It never assigns, starts, repairs,
 * or mutates an experiment.
 */
export type QualityState = "INSUFFICIENT" | "PENDING_REVIEW" | "READY" | "DEGRADED" | "INVALID" | "STOPPED";
export type ClusterOutcome = {
  assignmentId: string;
  schoolId: string;
  armId: string;
  metricId: MeasurementFamily;
  metricVersion: number;
  definitionVersion: number;
  occurredAt: string;
  value: number | null;
  source: "production" | "seed" | "fixture" | "demo" | "e2e" | "load_test" | "sandbox" | "internal_qa";
};
export type QualityReview = {
  reviewId: string;
  reviewerId: string;
  authorized: boolean;
  sampledAt: string;
  dimension: "age" | "subject" | "language" | "safety" | "helpfulness" | "hallucination" | "moderation";
  outcome: "PASS" | "FAIL" | "FALSE_POSITIVE" | "FALSE_NEGATIVE";
  evidenceId: string;
};
export type QualityPolicy = {
  evaluatedAt: string;
  minimumClustersPerArm: number;
  maximumMissingRate: number;
  maximumLatencyMs: number;
  maximumFutureSkewMs: number;
  maximumLateMs: number;
  requireReviewDimensions: QualityReview["dimension"][];
  sequentialCheckpoints: string[];
  comparisonCount?: number;
  minimumDetectableEffect?: number;
};
export type QualitySnapshot = {
  snapshotId: string;
  tenantId: string;
  definition: ExperimentDefinition;
  assignments: Assignment[];
  exposures: unknown[];
  metricEvents: unknown[];
  outcomes: ClusterOutcome[];
  reviews: QualityReview[];
  priorEvaluationSnapshotIds?: string[];
};
export type QualityAuditRecord = {
  action: "experiment.quality_evaluated" | "experiment.quality_invalidated" | "experiment.quality_stop_recommended";
  snapshotId: string;
  evidenceHash: string;
  occurredAt: string;
  reasons: string[];
};
export type ClusterComparison = {
  armId: string;
  clusters: number;
  difference: number | null;
  confidenceInterval95: [number, number] | null;
  conclusion: "INSUFFICIENT" | "UNCERTAIN" | "NEUTRAL" | "POSITIVE" | "HARMFUL";
};
export type QualityReport = {
  state: QualityState;
  evidenceHash: string;
  reasons: string[];
  reconciliation: { assigned: number; exposed: number; assignmentWithoutExposure: number; exposureWithoutAssignment: number; duplicates: number; malformed: number; crossSchool: number };
  freshness: { late: number; futureDated: number; outOfWindow: number; missingOutcomes: number; missingRate: number; maximumLatencyMs: number };
  srm: ReturnType<typeof detectSampleRatioMismatch>;
  comparisons: ClusterComparison[];
  reviews: { required: string[]; missing: string[]; unauthorized: number; failures: number };
  audit: QualityAuditRecord[];
};

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const evidenceHash = (snapshot: QualitySnapshot) => createHash("sha256").update(canonical(snapshot)).digest("hex");
const zForComparisons = (count: number) => count <= 1 ? 1.96 : count === 2 ? 2.241 : count === 3 ? 2.394 : 2.576;

function clusterComparison(control: ClusterOutcome[], treatment: ClusterOutcome[], armId: string, policy: QualityPolicy): ClusterComparison {
  if (control.length < policy.minimumClustersPerArm || treatment.length < policy.minimumClustersPerArm) return { armId, clusters: treatment.length, difference: null, confidenceInterval95: null, conclusion: "INSUFFICIENT" };
  const mean = (rows: ClusterOutcome[]) => rows.reduce((sum, row) => sum + (row.value ?? 0), 0) / rows.length;
  const variance = (rows: ClusterOutcome[], average: number) => rows.length < 2 ? 0 : rows.reduce((sum, row) => sum + ((row.value ?? 0) - average) ** 2, 0) / (rows.length - 1);
  const c = mean(control), t = mean(treatment), difference = t - c;
  const margin = zForComparisons(policy.comparisonCount ?? 1) * Math.sqrt(variance(control, c) / control.length + variance(treatment, t) / treatment.length);
  const interval: [number, number] = [difference - margin, difference + margin];
  const conclusion = interval[0] <= 0 && interval[1] >= 0 ? "NEUTRAL" : interval[0] > 0 ? "POSITIVE" : "HARMFUL";
  return { armId, clusters: treatment.length, difference, confidenceInterval95: interval, conclusion };
}

export function evaluateExperimentQuality(snapshot: QualitySnapshot, policy: QualityPolicy): QualityReport {
  if (Number.isNaN(Date.parse(policy.evaluatedAt))) throw new Error("invalid_quality_evaluation_time");
  const reasons: string[] = [...validateExperimentDefinition(snapshot.definition).map((reason) => `invalid_definition:${reason}`)];
  const evaluatedAt = Date.parse(policy.evaluatedAt), startAt = Date.parse(snapshot.definition.startAt), endAt = Date.parse(snapshot.definition.endAt);
  if (!policy.sequentialCheckpoints.includes(policy.evaluatedAt)) reasons.push("unplanned_sequential_evaluation");
  if ((snapshot.priorEvaluationSnapshotIds ?? []).includes(snapshot.snapshotId)) reasons.push("repeated_evaluation_snapshot");
  const assignments = snapshot.assignments.filter((assignment) => assignment.experimentId === snapshot.definition.experimentId && assignment.experimentVersion === snapshot.definition.version);
  const assignmentById = new Map(assignments.map((assignment) => [assignment.assignmentId, assignment]));
  const ingestion = ingestGovernedEvents(snapshot.exposures);
  const exposureRows = ingestion.accepted.filter((event) => event.name === "governed.experiment.exposure");
  let crossSchool = 0, exposureWithoutAssignment = 0, outOfWindow = 0, futureDated = 0, late = 0;
  const exposedAssignments = new Set<string>();
  for (const exposure of exposureRows) {
    const metadata = exposure.metadata as Record<string, unknown>;
    const assignment = assignmentById.get(String(metadata.assignmentId));
    if (!assignment || metadata.experimentId !== snapshot.definition.experimentId || metadata.experimentVersion !== snapshot.definition.version || metadata.armId !== assignment.armId) { exposureWithoutAssignment++; continue; }
    if (exposure.schoolId !== assignment.schoolId) { crossSchool++; continue; }
    const occurredAt = Date.parse(exposure.occurredAt);
    if (occurredAt > evaluatedAt + policy.maximumFutureSkewMs) futureDated++;
    if (occurredAt < startAt || occurredAt >= endAt) outOfWindow++;
    if (evaluatedAt - occurredAt > policy.maximumLateMs) late++;
    exposedAssignments.add(assignment.assignmentId);
  }
  const metricIngestion = ingestGovernedEvents(snapshot.metricEvents);
  const syntheticOutcomes = snapshot.outcomes.filter((outcome) => outcome.source !== "production").length;
  const invalidOutcomes = snapshot.outcomes.filter((outcome) => outcome.schoolId !== assignmentById.get(outcome.assignmentId)?.schoolId || outcome.metricVersion !== snapshot.definition.metricVersion || outcome.definitionVersion !== snapshot.definition.version || outcome.value === null || !Number.isFinite(outcome.value) || Date.parse(outcome.occurredAt) > evaluatedAt + policy.maximumFutureSkewMs || Date.parse(outcome.occurredAt) < startAt || Date.parse(outcome.occurredAt) >= endAt);
  const productionOutcomes = snapshot.outcomes.filter((outcome) => outcome.source === "production" && !invalidOutcomes.includes(outcome));
  const uniqueOutcomeKeys = new Set<string>();
  const replayedOutcomes = productionOutcomes.filter((outcome) => { const key = `${outcome.assignmentId}:${outcome.metricId}:${outcome.occurredAt}`; if (uniqueOutcomeKeys.has(key)) return true; uniqueOutcomeKeys.add(key); return false; });
  const usableOutcomes = productionOutcomes.filter((outcome) => !replayedOutcomes.includes(outcome));
  const missingOutcomes = [...exposedAssignments].filter((id) => !usableOutcomes.some((outcome) => outcome.assignmentId === id)).length;
  const missingRate = exposedAssignments.size ? missingOutcomes / exposedAssignments.size : 1;
  const assignmentWithoutExposure = assignments.filter((assignment) => !exposedAssignments.has(assignment.assignmentId)).length;
  const maximumLatencyMs = exposureRows.reduce((maximum, event) => Math.max(maximum, Math.max(0, evaluatedAt - Date.parse(event.occurredAt))), 0);
  const srm = detectSampleRatioMismatch(snapshot.definition, assignments);
  const reviews = snapshot.reviews.filter((review) => Date.parse(review.sampledAt) <= evaluatedAt);
  const missingReviews = policy.requireReviewDimensions.filter((dimension) => !reviews.some((review) => review.dimension === dimension && review.authorized && review.outcome === "PASS"));
  const reviewFailures = reviews.filter((review) => review.outcome === "FAIL" || review.outcome === "FALSE_NEGATIVE").length;
  const outcomesByArm = new Map(snapshot.definition.arms.map((arm) => [arm.id, usableOutcomes.filter((outcome) => outcome.metricId === snapshot.definition.primaryMetrics[0] && outcome.armId === arm.id)]));
  const control = outcomesByArm.get(snapshot.definition.controlArm) ?? [];
  const comparisons = snapshot.definition.arms.filter((arm) => arm.id !== snapshot.definition.controlArm).map((arm) => clusterComparison(control, outcomesByArm.get(arm.id) ?? [], arm.id, policy));
  const guardrailFailures = usableOutcomes.some((outcome) => snapshot.definition.guardrails.some((guardrail) => guardrail.metricId === outcome.metricId && (guardrail.direction === "MAX" ? outcome.value! > guardrail.threshold : outcome.value! < guardrail.threshold)));
  if (ingestion.quarantined.length || metricIngestion.quarantined.length || ingestion.duplicates || metricIngestion.duplicates || crossSchool || exposureWithoutAssignment || futureDated || outOfWindow || invalidOutcomes.length || replayedOutcomes.length || syntheticOutcomes) reasons.push("invalid_evidence");
  if (srm.status === "SRM_DETECTED") reasons.push("sample_ratio_mismatch");
  if (guardrailFailures) reasons.push("guardrail_breach");
  if (missingRate > policy.maximumMissingRate || maximumLatencyMs > policy.maximumLatencyMs || late) reasons.push("degraded_data_freshness");
  if (missingReviews.length || reviews.some((review) => !review.authorized)) reasons.push("human_review_pending");
  if (reviewFailures) reasons.push("human_review_failure");
  if (comparisons.some((comparison) => comparison.conclusion === "INSUFFICIENT") || policy.minimumDetectableEffect !== undefined && comparisons.some((comparison) => comparison.difference !== null && Math.abs(comparison.difference) < policy.minimumDetectableEffect)) reasons.push("insufficient_statistical_readiness");
  const fatal = reasons.some((reason) => ["invalid_evidence", "sample_ratio_mismatch", "guardrail_breach", "human_review_failure", "invalid_definition:mandatory_safety_policy_cannot_vary"].includes(reason));
  const state: QualityState = fatal ? (guardrailFailures || srm.status === "SRM_DETECTED" ? "STOPPED" : "INVALID") : reasons.includes("degraded_data_freshness") ? "DEGRADED" : reasons.length ? (reasons.includes("insufficient_statistical_readiness") ? "INSUFFICIENT" : "PENDING_REVIEW") : "READY";
  const hash = evidenceHash(snapshot);
  const audit: QualityAuditRecord[] = [{ action: "experiment.quality_evaluated", snapshotId: snapshot.snapshotId, evidenceHash: hash, occurredAt: policy.evaluatedAt, reasons }];
  if (state === "INVALID") audit.push({ action: "experiment.quality_invalidated", snapshotId: snapshot.snapshotId, evidenceHash: hash, occurredAt: policy.evaluatedAt, reasons });
  if (state === "STOPPED") audit.push({ action: "experiment.quality_stop_recommended", snapshotId: snapshot.snapshotId, evidenceHash: hash, occurredAt: policy.evaluatedAt, reasons });
  return { state, evidenceHash: hash, reasons, reconciliation: { assigned: assignments.length, exposed: exposedAssignments.size, assignmentWithoutExposure, exposureWithoutAssignment, duplicates: ingestion.duplicates + metricIngestion.duplicates + replayedOutcomes.length, malformed: ingestion.quarantined.length + metricIngestion.quarantined.length, crossSchool }, freshness: { late, futureDated, outOfWindow, missingOutcomes, missingRate, maximumLatencyMs }, srm, comparisons, reviews: { required: policy.requireReviewDimensions, missing: missingReviews, unauthorized: reviews.filter((review) => !review.authorized).length, failures: reviewFailures }, audit };
}
