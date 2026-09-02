import type { QualityReport } from "@/lib/experiments/qualityOperations";

export type ReleaseGateDefinition = {
  gateId: string;
  version: number;
  scope: string;
  requiredMetricIds: string[];
  requiredReviewDomains: string[];
  minimumSamples: number;
  blockingSeverities: string[];
  owner: string;
};

export type ReleaseGateResult = {
  gateId: string;
  version: number;
  evaluatedAt: string;
  result: "PASS" | "WARN" | "BLOCK" | "INSUFFICIENT_EVIDENCE";
  reasons: string[];
  rollbackRecommended: boolean;
};

export function evaluateReleaseGate(
  definition: ReleaseGateDefinition,
  quality: QualityReport,
  fixtureFailures: string[],
  reviews: Array<{ domain: string; outcome: string }>,
  now: string,
): ReleaseGateResult {
  const reasons: string[] = [];
  if (fixtureFailures.length > 0) reasons.push(...fixtureFailures.map((id) => `regression_fixture_failed:${id}`));
  if (quality.state === "STOPPED" || quality.state === "INVALID") reasons.push(`quality_state:${quality.state}`);
  if (quality.state === "DEGRADED" || quality.state === "PENDING_REVIEW") reasons.push(`quality_state:${quality.state}`);
  const missingReviews = definition.requiredReviewDomains.filter((domain) => !reviews.some((review) => review.domain === domain && review.outcome === "PASS"));
  if (missingReviews.length) reasons.push(...missingReviews.map((domain) => `review_missing:${domain}`));

  const hardBlock = fixtureFailures.length > 0 || quality.state === "STOPPED" || quality.state === "INVALID";
  const insufficientEvidence = quality.state === "INSUFFICIENT";
  const degradedOrPendingReview = quality.state === "DEGRADED" || quality.state === "PENDING_REVIEW";

  const result: ReleaseGateResult["result"] = hardBlock ? "BLOCK" : insufficientEvidence ? "INSUFFICIENT_EVIDENCE" : degradedOrPendingReview || missingReviews.length ? "WARN" : "PASS";

  return {
    gateId: definition.gateId,
    version: definition.version,
    evaluatedAt: now,
    result,
    reasons,
    rollbackRecommended: hardBlock,
  };
}
