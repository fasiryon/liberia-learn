import { describe, expect, it } from "vitest";
import { assessDepth } from "@/lib/curriculum/benchmarking/depth";
import { buildCoverageMatrixRow, buildCurriculumGapReport } from "@/lib/curriculum/benchmarking/gapEngine";
import type { CoverageMapping, GapCompetency, GapObjective, GapTarget } from "@/lib/curriculum/benchmarking/types";

const objectives: GapObjective[] = [{ id: "moe1", code: "MOE.G9.MATH.SET.1", criticality: "CRITICAL", verificationStatus: "VERIFIED" }];
const competencies: GapCompetency[] = [{ id: "base1", code: "WAEC.LJHSCE.MATH.1", criticality: "CRITICAL", verificationStatus: "VERIFIED", applicable: true }];
const targets: GapTarget[] = [
  { id: "mastery1", code: "LL.G9.MATH.SET.M1", targetLevel: "MASTERY" },
  { id: "extension1", code: "LL.G9.MATH.SET.X1", targetLevel: "EXTENSION" },
];

function mapping(overrides: Partial<CoverageMapping> = {}): CoverageMapping {
  return {
    id: "map1",
    moeObjectiveId: "moe1",
    baselineCompetencyId: "base1",
    learningTargetId: "mastery1",
    coverage: "FULL",
    depthRelation: "ABOVE_BASELINE",
    confidence: 0.9,
    evidenceRefs: [{ sourceVersionId: "sv1", locator: "page 37" }],
    status: "PLATFORM_REVIEWED",
    ...overrides,
  };
}

describe("P2-C cognitive demand taxonomy", () => {
  it("classifies above-baseline depth without presenting a scientific score", () => {
    expect(assessDepth({ baselineCategory: "PROCEDURAL_FLUENCY", observedCategory: "REASONING", rationale: "Learners must justify and generalize the procedure.", evidenceRefs: ["lesson:1"], reviewMethod: "PLATFORM_REVIEW", confidence: 0.82 })).toMatchObject({
      relation: "SIGNIFICANTLY_ABOVE_BASELINE",
      taxonomyVersion: "LIBERIALEARN_COGNITIVE_DEMAND_V1",
      precisionNotice: "ORDINAL_JUDGMENT_NOT_SCIENTIFIC_MEASUREMENT",
    });
  });

  it("requires rationale, evidence, and bounded confidence", () => {
    expect(() => assessDepth({ baselineCategory: "RECALL", observedCategory: "APPLICATION", rationale: "", evidenceRefs: ["x"], reviewMethod: "AI", confidence: 0.8 })).toThrow("DEPTH_RATIONALE_REQUIRED");
    expect(() => assessDepth({ baselineCategory: "RECALL", observedCategory: "APPLICATION", rationale: "Evidence-backed rationale", evidenceRefs: [], reviewMethod: "AI", confidence: 0.8 })).toThrow("DEPTH_EVIDENCE_REQUIRED");
  });
});

describe("P2-C deterministic curriculum gap engine", () => {
  it("reports complete above baseline when all required targets are covered", () => {
    const report = buildCurriculumGapReport({
      moeObjectives: objectives,
      baselineCompetencies: competencies,
      learningTargets: targets,
      mappings: [mapping(), mapping({ id: "map-ext", moeObjectiveId: null, baselineCompetencyId: null, learningTargetId: "extension1", depthRelation: "SIGNIFICANTLY_ABOVE_BASELINE" })],
    });
    expect(report).toMatchObject({ waecBaselineCoverageStatus: "COMPLETE_ABOVE_BASELINE", readinessIndicator: "WAEC_BASELINE_READY", uncoveredBaselineCompetencies: [], underDepthCompetencies: [], readinessDisclaimer: "NO_PASS_GUARANTEE" });
  });

  it("makes one missing critical competency a no-go even when percentage could look high", () => {
    const report = buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: competencies, learningTargets: targets, mappings: [] });
    expect(report.noGoReasons).toContain("CRITICAL_BASELINE_GAP");
    expect(report.readinessIndicator).toBe("NOT_READY");
  });

  it("distinguishes partial and under-depth coverage", () => {
    expect(buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: competencies, learningTargets: targets, mappings: [mapping({ coverage: "PARTIAL" })] }).partiallyCoveredCompetencies).toEqual(["WAEC.LJHSCE.MATH.1"]);
    expect(buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: competencies, learningTargets: targets, mappings: [mapping({ depthRelation: "BELOW_BASELINE" })] }).waecBaselineCoverageStatus).toBe("BELOW_BASELINE");
  });

  it("treats early-grade no-WAEC scope as not applicable", () => {
    const report = buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: [{ ...competencies[0], applicable: false }], learningTargets: [], mappings: [] });
    expect(report).toMatchObject({ waecBaselineCoverageStatus: "NOT_APPLICABLE", readinessIndicator: "NOT_APPLICABLE" });
  });

  it("does not claim readiness when the authoritative competency source is missing", () => {
    const report = buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: [{ ...competencies[0], verificationStatus: "SOURCE_MISSING" }], learningTargets: targets, mappings: [mapping()] });
    expect(report).toMatchObject({ waecBaselineCoverageStatus: "UNKNOWN", readinessIndicator: "UNKNOWN" });
  });

  it("flags evidence-free and low-confidence mappings", () => {
    const report = buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: competencies, learningTargets: targets, mappings: [mapping({ confidence: 0.4, evidenceRefs: [] })] });
    expect(report.unsupportedMappingIds).toEqual(["map1"]);
    expect(report.noGoReasons).toContain("UNSUPPORTED_MAPPING");
  });

  it("builds an operational coverage matrix with cautious percentages", () => {
    const mappings = [mapping({ confidence: 0.4, evidenceRefs: [] })];
    const report = buildCurriculumGapReport({ moeObjectives: objectives, baselineCompetencies: competencies, learningTargets: targets, mappings });
    expect(buildCoverageMatrixRow({ grade: 9, subject: "Mathematics", exam: "LJHSCE", report, baselineCompetencyCount: 1, mappings, reviewState: "PLATFORM_REVIEWED" })).toMatchObject({ coveragePercent: 100, baselineCompetencyCount: 1, mappedCompetencyCount: 1, noGo: true });
  });
});
