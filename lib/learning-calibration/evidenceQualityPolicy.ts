import {
  validateGovernedEvidence,
  type GovernedEvidence,
  type GovernedEvidenceType,
} from "@/lib/learning-evidence/evidenceContract";

/**
 * Versioned evidence-quality policy.
 *
 * This policy never produces gradebook weights ("homework = 10%") and never
 * changes canonical mastery. It describes each governed evidence record by
 * observable characteristics and assigns an ordinal corroboration class that
 * is used only for evidence *sufficiency* (how much the platform knows), not
 * for the mastery estimate (what the learner knows). Canonical mastery remains
 * the exclusive output of the Student Learning Model reducer.
 */
export const EVIDENCE_QUALITY_POLICY_VERSION = "evidence-quality-policy/1.0.0" as const;

export type EvidenceIndependence = "INDEPENDENT" | "HINTED" | "ASSISTED";
export type EvidenceSupervision = "CONTROLLED" | "SUPERVISED" | "UNSUPERVISED";
export type EvidenceRecency = "FRESH" | "AGING" | "STALE";
export type EvidenceDifficulty = "BELOW_GRADE" | "AT_GRADE" | "ABOVE_GRADE" | "UNSPECIFIED";
export type EvidenceAttempts = "FIRST_ATTEMPT" | "RETRIED" | "MANY_RETRIES";
export type EvidenceReliability = "VERIFIED" | "REVIEWED" | "SERVER_SCORED" | "UNASSESSED";
export type CorroborationClass = "STRONG" | "MODERATE" | "WEAK" | "EXCLUDED";

export type EvidenceCharacteristics = Readonly<{
  sourceType: GovernedEvidenceType;
  independence: EvidenceIndependence;
  supervision: EvidenceSupervision;
  recency: EvidenceRecency;
  ageDays: number;
  difficulty: EvidenceDifficulty;
  attempts: EvidenceAttempts;
  reliability: EvidenceReliability;
  directness: GovernedEvidence["strength"]["directness"];
  provenance: Readonly<{
    source: GovernedEvidence["provenance"]["source"];
    runtime: GovernedEvidence["provenance"]["runtime"];
    offline: boolean;
    priorRecord: boolean;
  }>;
  /** True when the record carries an interpretable performance outcome. */
  performanceObserved: boolean;
}>;

export type EvidenceQualityAssessment = Readonly<{
  policyVersion: typeof EVIDENCE_QUALITY_POLICY_VERSION;
  evidenceId: string;
  conceptId: string;
  independenceKey: string;
  occurredAt: string;
  characteristics: EvidenceCharacteristics;
  corroboration: CorroborationClass;
  /** Correct share of this record when observable; null otherwise. */
  observedOutcome: number | null;
  reasons: readonly string[];
  authority: Readonly<{ mayChangeCanonicalMastery: false; isGradebookWeight: false }>;
}>;

/** Default supervision by source type when no human verified the record. */
const DEFAULT_SUPERVISION: Readonly<Record<GovernedEvidenceType, EvidenceSupervision>> = Object.freeze({
  LESSON_COMPLETION: "UNSUPERVISED",
  CLASSWORK: "SUPERVISED",
  HOMEWORK: "UNSUPERVISED",
  PRACTICE: "UNSUPERVISED",
  QUIZ: "CONTROLLED",
  DIAGNOSTIC: "CONTROLLED",
  EXAM_TEST: "CONTROLLED",
  PROJECT: "UNSUPERVISED",
  PRACTICAL: "SUPERVISED",
  LAB: "UNSUPERVISED",
  SIMULATION: "UNSUPERVISED",
});

export const EVIDENCE_QUALITY_POLICY_V1 = Object.freeze({
  version: EVIDENCE_QUALITY_POLICY_VERSION,
  status: "STARTING_HYPOTHESIS_REQUIRES_EDUCATIONAL_REVIEW" as const,
  freshDays: 14,
  agingDays: 60,
  manyRetries: 3,
  defaultSupervision: DEFAULT_SUPERVISION,
  /** Completion is participation, not performance. */
  completionOnlyTypes: Object.freeze(["LESSON_COMPLETION"] as const),
});

const DAY_MS = 86_400_000;

function iso(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(`${label}_timestamp_invalid`);
  return parsed;
}

function observedOutcome(evidence: GovernedEvidence): number | null {
  const { performance } = evidence;
  if (performance.correct !== null) return performance.correct ? 1 : 0;
  if (performance.score !== null && performance.maxScore !== null) {
    return Math.max(0, Math.min(1, performance.score / performance.maxScore));
  }
  if (performance.outcome === "CORRECT") return 1;
  if (performance.outcome === "INCORRECT" || performance.outcome === "FAILED") return 0;
  return null;
}

function difficulty(evidence: GovernedEvidence): EvidenceDifficulty {
  const declared = evidence.performance.payload?.difficultyBand;
  return declared === "BELOW_GRADE" || declared === "AT_GRADE" || declared === "ABOVE_GRADE" ? declared : "UNSPECIFIED";
}

const DOWNGRADE: Readonly<Record<CorroborationClass, CorroborationClass>> = Object.freeze({
  STRONG: "MODERATE", MODERATE: "WEAK", WEAK: "WEAK", EXCLUDED: "EXCLUDED",
});

export function assessEvidenceQuality(
  evidence: GovernedEvidence,
  options: { asOf: string; policy?: typeof EVIDENCE_QUALITY_POLICY_V1 },
): EvidenceQualityAssessment {
  validateGovernedEvidence(evidence);
  const policy = options.policy ?? EVIDENCE_QUALITY_POLICY_V1;
  if (policy.version !== EVIDENCE_QUALITY_POLICY_VERSION) throw new Error("evidence_quality_policy_version_unsupported");
  const asOfMs = iso(options.asOf, "evidence_quality_as_of");
  const occurredMs = iso(evidence.occurredAt, "evidence_quality_occurred");
  if (occurredMs > asOfMs) throw new Error("evidence_quality_after_as_of");
  const ageDays = Math.round(((asOfMs - occurredMs) / DAY_MS) * 100) / 100;
  const { strength, provenance } = evidence;

  const independence: EvidenceIndependence = strength.assistanceUsed ? "ASSISTED" : strength.hintCount > 0 ? "HINTED" : "INDEPENDENT";
  const supervision: EvidenceSupervision = strength.humanVerified || provenance.source === "TEACHER"
    ? (policy.defaultSupervision[evidence.evidenceType] === "CONTROLLED" ? "CONTROLLED" : "SUPERVISED")
    : policy.defaultSupervision[evidence.evidenceType];
  const recency: EvidenceRecency = ageDays <= policy.freshDays ? "FRESH" : ageDays <= policy.agingDays ? "AGING" : "STALE";
  const attempts: EvidenceAttempts = strength.retryCount === 0 ? "FIRST_ATTEMPT"
    : strength.retryCount >= policy.manyRetries ? "MANY_RETRIES" : "RETRIED";
  const reliability: EvidenceReliability = strength.reliability === "VERIFIED" ? "VERIFIED"
    : strength.reliability === "REVIEWED" ? "REVIEWED" : strength.serverScored ? "SERVER_SCORED" : "UNASSESSED";
  const outcome = observedOutcome(evidence);
  const characteristics: EvidenceCharacteristics = Object.freeze({
    sourceType: evidence.evidenceType,
    independence, supervision, recency, ageDays,
    difficulty: difficulty(evidence),
    attempts, reliability,
    directness: strength.directness,
    provenance: Object.freeze({
      source: provenance.source,
      runtime: provenance.runtime,
      offline: evidence.offline.isOffline,
      priorRecord: provenance.runtime === "IMPORT",
    }),
    performanceObserved: outcome !== null,
  });

  const reasons: string[] = [];
  let corroboration: CorroborationClass;
  if ((policy.completionOnlyTypes as readonly string[]).includes(evidence.evidenceType)) {
    corroboration = "EXCLUDED"; reasons.push("COMPLETION_IS_NOT_PERFORMANCE");
  } else if (outcome === null) {
    corroboration = "EXCLUDED"; reasons.push("NO_OBSERVABLE_PERFORMANCE");
  } else if (strength.directness === "INFERRED") {
    corroboration = "EXCLUDED"; reasons.push("INFERRED_NOT_OBSERVED");
  } else if (independence === "ASSISTED" || attempts === "MANY_RETRIES" ||
    (supervision === "UNSUPERVISED" && reliability === "UNASSESSED")) {
    corroboration = "WEAK";
    if (independence === "ASSISTED") reasons.push("ASSISTED_PERFORMANCE");
    if (attempts === "MANY_RETRIES") reasons.push("MANY_RETRIES");
    if (supervision === "UNSUPERVISED" && reliability === "UNASSESSED") reasons.push("UNSUPERVISED_AND_UNASSESSED");
  } else if (independence === "INDEPENDENT" && attempts === "FIRST_ATTEMPT" && supervision !== "UNSUPERVISED" &&
    reliability !== "UNASSESSED" && strength.directness === "DIRECT") {
    corroboration = "STRONG"; reasons.push("INDEPENDENT_SUPERVISED_DIRECT");
  } else {
    corroboration = "MODERATE";
    if (independence === "HINTED") reasons.push("HINTED_PERFORMANCE");
    if (attempts === "RETRIED") reasons.push("RETRIED");
    if (supervision === "UNSUPERVISED") reasons.push("UNSUPERVISED");
    if (strength.directness === "INDIRECT") reasons.push("INDIRECT");
  }
  if (recency === "STALE" && corroboration !== "EXCLUDED") {
    corroboration = DOWNGRADE[corroboration]; reasons.push("STALE_EVIDENCE");
  }

  return Object.freeze({
    policyVersion: EVIDENCE_QUALITY_POLICY_VERSION,
    evidenceId: evidence.evidenceId,
    conceptId: evidence.objective.conceptId,
    independenceKey: evidence.strength.independenceKey,
    occurredAt: evidence.occurredAt,
    characteristics,
    corroboration,
    observedOutcome: outcome,
    reasons: Object.freeze(reasons),
    authority: Object.freeze({ mayChangeCanonicalMastery: false as const, isGradebookWeight: false as const }),
  });
}
