import { describe, expect, it } from "vitest";
import {
  AI_REVIEW_DIMENSIONS,
  aiReviewDisagreementSignature,
  parseAIReviewResult,
  validateDeterministicAIReview,
} from "@/lib/curriculum/review/aiEvidenceValidator";

const dimensions = Object.fromEntries(AI_REVIEW_DIMENSIONS.map((key) => [key, {
  status: "PASS",
  severity: "none",
  rationale: `${key} is supported by the supplied evidence without an external authority claim.`,
  evidenceRefs: ["revision-evidence-1"],
}]));

const review = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  recommendation: "APPROVE",
  confidence: 91,
  rationale: "The platform review supports approval on the supplied revision evidence.",
  dimensions,
  ...overrides,
});

const validate = (raw: string, overrides: Record<string, unknown> = {}) => validateDeterministicAIReview({
  parsed: parseAIReviewResult(raw),
  availableEvidence: [{ id: "revision-evidence-1", status: "ACTIVE" }],
  evidenceRequirements: { required: true, approvalBlocked: false },
  minimumConfidence: 70,
  specialty: "SUBJECT_MATTER",
  ...overrides,
});

describe("P2-B deterministic AI review evidence and authority validation", () => {
  it("accepts a complete evidence-grounded platform review", () => {
    expect(validate(review())).toMatchObject({ passed: true, approvalBlocked: false });
  });

  it("hard-blocks approval when the task evidence policy is blocked", () => {
    expect(validate(review(), { evidenceRequirements: { required: true, approvalBlocked: true } })).toMatchObject({
      passed: false,
      approvalBlocked: true,
      reasons: ["APPROVAL_BLOCKED_BY_EVIDENCE_POLICY"],
    });
  });

  it("rejects missing and fabricated dimension evidence references", () => {
    const fabricatedDimensions = { ...dimensions, standards_alignment: { ...dimensions.standards_alignment, evidenceRefs: ["invented"] } };
    expect(validate(review({ dimensions: fabricatedDimensions })).reasons).toContain("FABRICATED_OR_INACTIVE_EVIDENCE_REF:invented");
    expect(validate(review({ dimensions: Object.fromEntries(AI_REVIEW_DIMENSIONS.map((key) => [key, { ...dimensions[key], evidenceRefs: [] }])) }))).toMatchObject({
      passed: false,
      approvalBlocked: true,
      reasons: ["APPROVAL_WITHOUT_CITED_EVIDENCE"],
    });
  });

  it("rejects malformed dimensions, low confidence, and fabricated authority", () => {
    expect(validate(review({ dimensions: {} })).reasons).toContain("MALFORMED_DIMENSION:standards_alignment");
    expect(validate(review({ confidence: 69 })).reasons).toContain("LOW_CONFIDENCE_APPROVAL");
    expect(validate(review({ rationale: "This is WAEC-approved official content." })).reasons).toContain("AI_EXTERNAL_AUTHORITY_CLAIM_PROHIBITED");
  });

  it("reuses P2-C specificity validation for WAEC_ALIGNMENT", () => {
    const waecEvidence = [{
      id: "waec-subject",
      authorityType: "WAEC_LIBERIA" as const,
      canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
      sourceVersionId: "waec-v1",
      locator: "subject table",
      excerpt: "Mathematics is an examined subject.",
      verificationStatus: "VERIFIED" as const,
      evidenceSpecificity: "SUBJECT_LEVEL" as const,
    }];
    const waecAlignment = {
      relationshipType: "DIRECT",
      coverage: "FULL",
      depthRelation: "MEETS_BASELINE",
      cognitiveDimensions: ["APPLICATION"],
      rationale: "The supplied Mathematics subject evidence is asserted to establish this exact topic and its assessed cognitive depth.",
      objectiveEvidenceTerms: ["venn", "diagrams"],
      baselineEvidenceTerms: ["mathematics", "examined"],
      evidenceRefs: ["waec-subject"],
      confidence: 0.9,
      overfitToExamMechanics: false,
      prerequisiteGaps: [],
      authorityLabel: "AI_ASSESSED_ALIGNMENT",
      externalApprovalClaimed: false,
    };
    const result = validate(review({ waecAlignment }), {
      specialty: "WAEC_ALIGNMENT",
      waecAlignmentContext: {
        moeObjectiveWording: "Draw and use Venn diagrams to solve set problems",
        baselineExpectation: "Mathematics is examined as a subject",
        evidence: waecEvidence,
      },
    });
    expect(result.reasons).toContain("TOPIC_LEVEL_CLAIM_WITHOUT_TOPIC_LEVEL_EVIDENCE:relationshipType");
    expect(result.approvalBlocked).toBe(true);
  });

  it("detects substantive dimension disagreement with matching recommendations", () => {
    const first = { recommendation: "APPROVE", rubricResponses: dimensions };
    const second = { recommendation: "APPROVE", rubricResponses: { ...dimensions, safety: { ...dimensions.safety, status: "CONCERN" } } };
    expect(aiReviewDisagreementSignature(first)).not.toBe(aiReviewDisagreementSignature(second));
  });
});
