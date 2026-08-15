export const COGNITIVE_DEMAND_TAXONOMY_VERSION = "LIBERIALEARN_COGNITIVE_DEMAND_V1";

export const COGNITIVE_DEMAND_CATEGORIES = [
  "RECALL",
  "COMPREHENSION",
  "PROCEDURAL_FLUENCY",
  "APPLICATION",
  "ANALYSIS",
  "REASONING",
  "EVALUATION",
  "CREATION",
  "TRANSFER",
  "PROBLEM_MODELING",
] as const;

export type CognitiveDemandCategory = (typeof COGNITIVE_DEMAND_CATEGORIES)[number];

export type DepthRelation =
  | "BELOW_BASELINE"
  | "MEETS_BASELINE"
  | "ABOVE_BASELINE"
  | "SIGNIFICANTLY_ABOVE_BASELINE"
  | "NOT_COMPARABLE"
  | "UNKNOWN";

export type CoverageDegree = "NONE" | "PARTIAL" | "FULL";

export type CoverageStatus =
  | "COMPLETE_ABOVE_BASELINE"
  | "COMPLETE_AT_BASELINE"
  | "PARTIAL"
  | "BELOW_BASELINE"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "UNVERIFIED"
  | "STALE"
  | "SOURCE_MISSING"
  | "RIGHTS_LIMITED";

export type Criticality = "CRITICAL" | "HIGH" | "STANDARD" | "OPTIONAL";

export type GapObjective = {
  id: string;
  code: string;
  criticality: Criticality;
  verificationStatus: VerificationStatus;
};

export type GapCompetency = GapObjective & {
  applicable: boolean;
};

export type GapTarget = {
  id: string;
  code: string;
  targetLevel: "MASTERY" | "EXTENSION";
};

export type CoverageMapping = {
  id: string;
  moeObjectiveId?: string | null;
  baselineCompetencyId?: string | null;
  learningTargetId?: string | null;
  coverage: CoverageDegree;
  depthRelation: DepthRelation;
  confidence: number;
  evidenceRefs: unknown[];
  status: "DRAFT" | "AI_ASSESSED" | "PLATFORM_REVIEWED" | "STALE" | "REJECTED" | "SUPERSEDED";
};

export type CoverageMatrixRow = {
  grade: number;
  subject: string;
  exam: string | null;
  moeCoverageStatus: CoverageStatus;
  waecBaselineRelevance: boolean;
  baselineCompetencyCount: number;
  mappedCompetencyCount: number;
  coveragePercent: number | null;
  depthDistribution: Record<DepthRelation, number>;
  gaps: string[];
  unsupportedMappings: string[];
  sourceFreshness: VerificationStatus;
  reviewState: string;
  evidenceCompleteness: "COMPLETE" | "PARTIAL" | "MISSING";
  masteryDefinitionStatus: "COMPLETE" | "PARTIAL" | "MISSING";
  extensionDefinitionStatus: "COMPLETE" | "PARTIAL" | "MISSING";
  noGo: boolean;
};
