/**
 * Learning-mastery classification (LL-AEP-001), kept separate from academic grades.
 *
 *   NOT_YET_EVIDENCED  no verified independent evidence
 *   EMERGING           some verified independent evidence, below Developing
 *   DEVELOPING         enough independent items at a moderate accuracy
 *   SECURE             accurate independent performance on enough items across separate occasions
 *   ADVANCED           Secure, plus verified success on transfer to unfamiliar or more complex problems
 *
 * Input is a summary of VERIFIED or MASTERY_ADMITTED assessment evidence that is independent (no
 * hints, AI help or answer exposure). Assisted, provisional and raw evidence is never counted;
 * the caller's summary must already exclude it, and `assertIndependentSummary` checks the claim.
 */
import { LL_MASTERY_REQUIREMENTS, type LlMasteryState } from "@/lib/academic-policy/llAep001";

export type MasteryEvidenceSummary = Readonly<{
  objectiveId: string;
  /** Only verified/admitted, independent, official-or-practice-as-policy-allows evidence. */
  source: "VERIFIED_INDEPENDENT_EVIDENCE";
  independentItems: number;
  independentPointsEarned: number;
  independentPointsPossible: number;
  /** Distinct assessment occasions (different days/attempt sessions). */
  independentOccasions: number;
  verifiedTransferItems: number;
  transferPointsEarned: number;
  transferPointsPossible: number;
}>;

export type MasteryClassification = Readonly<{
  objectiveId: string;
  state: LlMasteryState;
  reasons: readonly string[];
  policyRef: "LL-AEP-001@1.0.0";
}>;

const pct = (earned: number, possible: number) => (possible > 0 ? (100 * earned) / possible : 0);

export function assertIndependentSummary(summary: MasteryEvidenceSummary): void {
  if (summary.source !== "VERIFIED_INDEPENDENT_EVIDENCE") throw new Error("records_mastery_requires_verified_independent_evidence");
  for (const value of [summary.independentItems, summary.independentOccasions, summary.verifiedTransferItems]) {
    if (!Number.isInteger(value) || value < 0) throw new Error("records_mastery_summary_invalid");
  }
  if (summary.independentPointsEarned > summary.independentPointsPossible || summary.transferPointsEarned > summary.transferPointsPossible) throw new Error("records_mastery_summary_invalid");
}

export function classifyMastery(summary: MasteryEvidenceSummary): MasteryClassification {
  assertIndependentSummary(summary);
  const reasons: string[] = [];
  const accuracy = pct(summary.independentPointsEarned, summary.independentPointsPossible);
  const { DEVELOPING, SECURE, ADVANCED } = LL_MASTERY_REQUIREMENTS;
  const result = (state: LlMasteryState) => Object.freeze({ objectiveId: summary.objectiveId, state, reasons: Object.freeze(reasons), policyRef: "LL-AEP-001@1.0.0" as const });

  if (summary.independentItems === 0) {
    reasons.push("no_verified_independent_evidence");
    return result("NOT_YET_EVIDENCED");
  }
  const secure = summary.independentItems >= SECURE.minIndependentItems
    && summary.independentOccasions >= SECURE.minIndependentOccasions
    && accuracy >= SECURE.minIndependentAccuracyPercent;
  if (secure) {
    const transferAccuracy = pct(summary.transferPointsEarned, summary.transferPointsPossible);
    if (summary.verifiedTransferItems >= ADVANCED.minVerifiedTransferItems && transferAccuracy >= ADVANCED.minTransferAccuracyPercent) {
      reasons.push("secure_with_verified_transfer");
      return result("ADVANCED");
    }
    reasons.push(summary.verifiedTransferItems === 0 ? "transfer_not_yet_evidenced" : "transfer_below_threshold");
    return result("SECURE");
  }
  if (summary.independentItems < SECURE.minIndependentItems) reasons.push("too_few_independent_items_for_secure");
  if (summary.independentOccasions < SECURE.minIndependentOccasions) reasons.push("single_occasion_only");
  if (accuracy < SECURE.minIndependentAccuracyPercent) reasons.push("accuracy_below_secure");
  if (summary.independentItems >= DEVELOPING.minIndependentItems && accuracy >= DEVELOPING.minIndependentAccuracyPercent) return result("DEVELOPING");
  return result("EMERGING");
}

const ORDER: readonly LlMasteryState[] = ["NOT_YET_EVIDENCED", "EMERGING", "DEVELOPING", "SECURE", "ADVANCED"];

export function masteryAtLeast(state: LlMasteryState, minimum: LlMasteryState): boolean {
  return ORDER.indexOf(state) >= ORDER.indexOf(minimum);
}
