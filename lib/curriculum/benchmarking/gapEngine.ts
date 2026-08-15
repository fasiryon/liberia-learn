import type {
  CoverageMapping,
  CoverageMatrixRow,
  CoverageStatus,
  DepthRelation,
  GapCompetency,
  GapObjective,
  GapTarget,
  VerificationStatus,
} from "./types";

const SUFFICIENT_DEPTH = new Set<DepthRelation>([
  "MEETS_BASELINE",
  "ABOVE_BASELINE",
  "SIGNIFICANTLY_ABOVE_BASELINE",
]);
const ABOVE_DEPTH = new Set<DepthRelation>(["ABOVE_BASELINE", "SIGNIFICANTLY_ABOVE_BASELINE"]);
const ACTIVE_MAPPING_STATES = new Set(["AI_ASSESSED", "PLATFORM_REVIEWED"]);

function bestMapping(
  mappings: CoverageMapping[],
  field: "moeObjectiveId" | "baselineCompetencyId" | "learningTargetId",
  id: string,
): CoverageMapping | undefined {
  return mappings
    .filter((mapping) => mapping[field] === id && ACTIVE_MAPPING_STATES.has(mapping.status))
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function worstFreshness(statuses: VerificationStatus[]): VerificationStatus {
  const order: VerificationStatus[] = [
    "SOURCE_MISSING",
    "STALE",
    "UNVERIFIED",
    "RIGHTS_LIMITED",
    "PARTIAL",
    "VERIFIED",
  ];
  return order.find((candidate) => statuses.includes(candidate)) ?? "UNVERIFIED";
}

export type CurriculumGapReport = {
  moeCoverageStatus: CoverageStatus;
  waecBaselineCoverageStatus: CoverageStatus;
  uncoveredMoeObjectives: string[];
  uncoveredBaselineCompetencies: string[];
  partiallyCoveredCompetencies: string[];
  underDepthCompetencies: string[];
  aboveBaselineCompetencies: string[];
  unsupportedMappingIds: string[];
  incompleteMasteryTargets: string[];
  missingExtensionTargets: string[];
  sourceFreshness: VerificationStatus;
  readinessIndicator: "WAEC_BASELINE_READY" | "NOT_READY" | "UNKNOWN" | "NOT_APPLICABLE";
  readinessDisclaimer: "NO_PASS_GUARANTEE";
  noGoReasons: string[];
};

export function buildCurriculumGapReport(input: {
  moeObjectives: GapObjective[];
  baselineCompetencies: GapCompetency[];
  learningTargets: GapTarget[];
  mappings: CoverageMapping[];
  minimumMappingConfidence?: number;
}): CurriculumGapReport {
  const minimumConfidence = input.minimumMappingConfidence ?? 0.7;
  const applicable = input.baselineCompetencies.filter((competency) => competency.applicable);
  const uncoveredMoeObjectives: string[] = [];
  const uncoveredBaselineCompetencies: string[] = [];
  const partiallyCoveredCompetencies: string[] = [];
  const underDepthCompetencies: string[] = [];
  const aboveBaselineCompetencies: string[] = [];
  const unsupportedMappingIds: string[] = [];
  const incompleteMasteryTargets: string[] = [];
  const missingExtensionTargets: string[] = [];

  for (const objective of input.moeObjectives) {
    const mapping = bestMapping(input.mappings, "moeObjectiveId", objective.id);
    if (!mapping || mapping.coverage !== "FULL") uncoveredMoeObjectives.push(objective.code);
  }

  for (const competency of applicable) {
    const mapping = bestMapping(input.mappings, "baselineCompetencyId", competency.id);
    if (!mapping || mapping.coverage === "NONE") {
      uncoveredBaselineCompetencies.push(competency.code);
      continue;
    }
    if (mapping.coverage === "PARTIAL") partiallyCoveredCompetencies.push(competency.code);
    if (mapping.coverage === "FULL" && !SUFFICIENT_DEPTH.has(mapping.depthRelation)) {
      underDepthCompetencies.push(competency.code);
    }
    if (mapping.coverage === "FULL" && ABOVE_DEPTH.has(mapping.depthRelation)) {
      aboveBaselineCompetencies.push(competency.code);
    }
    if (mapping.confidence < minimumConfidence || mapping.evidenceRefs.length === 0) {
      unsupportedMappingIds.push(mapping.id);
    }
  }

  const masteryTargets = input.learningTargets.filter((target) => target.targetLevel === "MASTERY");
  for (const target of masteryTargets) {
    const mapping = bestMapping(input.mappings, "learningTargetId", target.id);
    if (!mapping || mapping.coverage !== "FULL") incompleteMasteryTargets.push(target.code);
  }
  const extensionTargets = input.learningTargets.filter((target) => target.targetLevel === "EXTENSION");
  for (const target of extensionTargets) {
    const mapping = bestMapping(input.mappings, "learningTargetId", target.id);
    if (!mapping || mapping.coverage !== "FULL") missingExtensionTargets.push(target.code);
  }

  const criticalCodes = new Set(
    applicable
      .filter((competency) => competency.criticality === "CRITICAL")
      .map((competency) => competency.code),
  );
  const criticalGap = [
    ...uncoveredBaselineCompetencies,
    ...partiallyCoveredCompetencies,
    ...underDepthCompetencies,
  ].some((code) => criticalCodes.has(code));
  const baselineIncomplete =
    uncoveredBaselineCompetencies.length > 0 || partiallyCoveredCompetencies.length > 0;
  const sourceFreshness = worstFreshness([
    ...input.moeObjectives.map((objective) => objective.verificationStatus),
    ...applicable.map((competency) => competency.verificationStatus),
  ]);

  let waecBaselineCoverageStatus: CoverageStatus;
  if (applicable.length === 0) waecBaselineCoverageStatus = "NOT_APPLICABLE";
  else if (sourceFreshness === "SOURCE_MISSING" || sourceFreshness === "STALE") waecBaselineCoverageStatus = "UNKNOWN";
  else if (underDepthCompetencies.length > 0) waecBaselineCoverageStatus = "BELOW_BASELINE";
  else if (baselineIncomplete) waecBaselineCoverageStatus = "PARTIAL";
  else if (aboveBaselineCompetencies.length === applicable.length && incompleteMasteryTargets.length === 0) {
    waecBaselineCoverageStatus = "COMPLETE_ABOVE_BASELINE";
  } else waecBaselineCoverageStatus = "COMPLETE_AT_BASELINE";

  const moeCoverageStatus: CoverageStatus =
    input.moeObjectives.length === 0
      ? "UNKNOWN"
      : uncoveredMoeObjectives.length > 0
        ? "PARTIAL"
        : "COMPLETE_AT_BASELINE";

  const noGoReasons = [
    ...(criticalGap ? ["CRITICAL_BASELINE_GAP"] : []),
    ...(unsupportedMappingIds.length ? ["UNSUPPORTED_MAPPING"] : []),
    ...(sourceFreshness === "STALE" ? ["STALE_SOURCE_EVIDENCE"] : []),
    ...(sourceFreshness === "SOURCE_MISSING" ? ["AUTHORITATIVE_SOURCE_MISSING"] : []),
    ...(incompleteMasteryTargets.length ? ["MASTERY_TARGET_INCOMPLETE"] : []),
  ];

  const readinessIndicator =
    waecBaselineCoverageStatus === "NOT_APPLICABLE"
      ? "NOT_APPLICABLE"
      : waecBaselineCoverageStatus === "UNKNOWN"
        ? "UNKNOWN"
        : ["COMPLETE_ABOVE_BASELINE", "COMPLETE_AT_BASELINE"].includes(waecBaselineCoverageStatus) &&
            noGoReasons.length === 0
          ? "WAEC_BASELINE_READY"
          : "NOT_READY";

  return {
    moeCoverageStatus,
    waecBaselineCoverageStatus,
    uncoveredMoeObjectives,
    uncoveredBaselineCompetencies,
    partiallyCoveredCompetencies,
    underDepthCompetencies,
    aboveBaselineCompetencies,
    unsupportedMappingIds,
    incompleteMasteryTargets,
    missingExtensionTargets,
    sourceFreshness,
    readinessIndicator,
    readinessDisclaimer: "NO_PASS_GUARANTEE",
    noGoReasons,
  };
}

export function buildCoverageMatrixRow(input: {
  grade: number;
  subject: string;
  exam?: string | null;
  report: CurriculumGapReport;
  baselineCompetencyCount: number;
  mappings: CoverageMapping[];
  reviewState: string;
}): CoverageMatrixRow {
  const mapped = input.mappings.filter(
    (mapping) => mapping.baselineCompetencyId && mapping.coverage !== "NONE" && ACTIVE_MAPPING_STATES.has(mapping.status),
  );
  const depthDistribution = Object.fromEntries(
    ["BELOW_BASELINE", "MEETS_BASELINE", "ABOVE_BASELINE", "SIGNIFICANTLY_ABOVE_BASELINE", "NOT_COMPARABLE", "UNKNOWN"].map(
      (relation) => [relation, mapped.filter((mapping) => mapping.depthRelation === relation).length],
    ),
  ) as Record<DepthRelation, number>;
  const evidenceMappings = mapped.filter((mapping) => mapping.evidenceRefs.length > 0);

  return {
    grade: input.grade,
    subject: input.subject,
    exam: input.exam ?? null,
    moeCoverageStatus: input.report.moeCoverageStatus,
    waecBaselineRelevance: input.baselineCompetencyCount > 0,
    baselineCompetencyCount: input.baselineCompetencyCount,
    mappedCompetencyCount: new Set(mapped.map((mapping) => mapping.baselineCompetencyId)).size,
    coveragePercent:
      input.baselineCompetencyCount === 0
        ? null
        : Math.round((new Set(mapped.map((mapping) => mapping.baselineCompetencyId)).size / input.baselineCompetencyCount) * 100),
    depthDistribution,
    gaps: input.report.noGoReasons,
    unsupportedMappings: input.report.unsupportedMappingIds,
    sourceFreshness: input.report.sourceFreshness,
    reviewState: input.reviewState,
    evidenceCompleteness:
      mapped.length === 0 ? "MISSING" : evidenceMappings.length === mapped.length ? "COMPLETE" : "PARTIAL",
    masteryDefinitionStatus: input.report.incompleteMasteryTargets.length === 0 ? "COMPLETE" : "PARTIAL",
    extensionDefinitionStatus: input.report.missingExtensionTargets.length === 0 ? "COMPLETE" : "PARTIAL",
    noGo: input.report.noGoReasons.length > 0,
  };
}
