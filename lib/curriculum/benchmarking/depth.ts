import {
  COGNITIVE_DEMAND_TAXONOMY_VERSION,
  type CognitiveDemandCategory,
  type DepthRelation,
} from "./types";

const DEPTH_RANK: Record<CognitiveDemandCategory, number> = {
  RECALL: 1,
  COMPREHENSION: 2,
  PROCEDURAL_FLUENCY: 3,
  APPLICATION: 4,
  ANALYSIS: 5,
  REASONING: 6,
  EVALUATION: 7,
  CREATION: 8,
  TRANSFER: 9,
  PROBLEM_MODELING: 10,
};

export type DepthAssessment = {
  taxonomyVersion: typeof COGNITIVE_DEMAND_TAXONOMY_VERSION;
  baselineCategory: CognitiveDemandCategory;
  observedCategory: CognitiveDemandCategory;
  relation: DepthRelation;
  rationale: string;
  evidenceRefs: unknown[];
  reviewMethod: string;
  confidence: number;
  precisionNotice: "ORDINAL_JUDGMENT_NOT_SCIENTIFIC_MEASUREMENT";
};

export function assessDepth(input: {
  baselineCategory: CognitiveDemandCategory;
  observedCategory: CognitiveDemandCategory;
  rationale: string;
  evidenceRefs: unknown[];
  reviewMethod: string;
  confidence: number;
}): DepthAssessment {
  if (!input.rationale.trim()) throw new Error("DEPTH_RATIONALE_REQUIRED");
  if (input.evidenceRefs.length === 0) throw new Error("DEPTH_EVIDENCE_REQUIRED");
  if (input.confidence < 0 || input.confidence > 1) throw new Error("DEPTH_CONFIDENCE_OUT_OF_RANGE");

  const difference = DEPTH_RANK[input.observedCategory] - DEPTH_RANK[input.baselineCategory];
  const relation: DepthRelation =
    difference < 0
      ? "BELOW_BASELINE"
      : difference === 0
        ? "MEETS_BASELINE"
        : difference >= 3
          ? "SIGNIFICANTLY_ABOVE_BASELINE"
          : "ABOVE_BASELINE";

  return {
    taxonomyVersion: COGNITIVE_DEMAND_TAXONOMY_VERSION,
    baselineCategory: input.baselineCategory,
    observedCategory: input.observedCategory,
    relation,
    rationale: input.rationale.trim(),
    evidenceRefs: input.evidenceRefs,
    reviewMethod: input.reviewMethod,
    confidence: input.confidence,
    precisionNotice: "ORDINAL_JUDGMENT_NOT_SCIENTIFIC_MEASUREMENT",
  };
}
