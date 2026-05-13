export type ForecastType =
  | "student_risk"
  | "guardian_engagement"
  | "curriculum_weakness"
  | "teacher_support"
  | "school_operational_risk"
  | "district_national_aggregate";

export type Trajectory = "improving" | "stable" | "deteriorating" | "unknown";
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";
export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type ForecastScope = {
  schoolId?: string | null;
  districtId?: string | null;
  aggregateSafe?: boolean;
};

export type ForecastRange = {
  from: Date;
  to: Date;
};

export type ForecastEvidenceRef = {
  type: string;
  id: string | null;
  schoolId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ForecastFactor = {
  key: string;
  label: string;
  direction: "positive" | "negative" | "mixed" | "missing";
  score: number;
  evidence: ForecastEvidenceRef[];
};

export type PredictiveForecast = {
  id: string;
  type: ForecastType;
  targetType: string;
  targetId: string | null;
  schoolId: string | null;
  districtId: string | null;
  aggregateSafe: boolean;
  trajectory: Trajectory;
  riskBand: RiskBand;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  confidenceRationale: string[];
  contributingFactors: ForecastFactor[];
  evidenceRefs: ForecastEvidenceRef[];
  historicalTrendBasis: string;
  evaluationSupport: Record<string, unknown>;
  memoryLineageRefs: ForecastEvidenceRef[];
  recommendedActions: string[];
  warnings: string[];
  forecastFreshness: {
    generatedAt: Date;
    lastSignalAt: Date | null;
    stale: boolean;
  };
};

export type ForecastOutcomeInput = {
  forecastId: string;
  forecastType: ForecastType;
  outcome: "accurate" | "false_positive" | "missed_risk" | "improved_after_intervention" | "no_measurable_change";
  schoolId?: string | null;
  districtId?: string | null;
  actorId?: string | null;
  evidenceRefs?: ForecastEvidenceRef[];
  confidenceBefore?: number | null;
  notes?: string | null;
};

export type PredictionReviewDecision = "acknowledged" | "escalated" | "dismissed" | "needs_more_data";

export type PredictionReviewInput = {
  forecastId: string;
  forecastType: ForecastType;
  decision: PredictionReviewDecision;
  schoolId?: string | null;
  districtId?: string | null;
  actorId?: string | null;
  confidenceScore?: number | null;
  evidenceRefs?: ForecastEvidenceRef[];
  rationale?: string | null;
};
