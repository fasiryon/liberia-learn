import { describe, expect, it } from "vitest";
import { buildAlignmentReviewTopology, needsAlignmentAdjudication, validateAiWaecAlignment } from "@/lib/curriculum/benchmarking/aiWaecAlignment";
import { evaluateReviewPolicy } from "@/lib/curriculum/review/policy";

// Only MOE-side evidence is cited here (no WAEC-authority item), so per the
// evidence-specificity guard in aiWaecAlignment.ts this cannot support a
// DIRECT/MEETS_BASELINE claim -- see __tests__/p2c/real-data-pilot.test.ts
// for the real evidence and the guard's dedicated positive/negative cases.
const evidence = [{
  id: "moe-math-p37",
  authorityType: "LIBERIA_MOE" as const,
  canonicalUrl: "https://moe.gov.lr/wp-content/uploads/2019/09/GRADE-7-9.zip",
  sourceVersionId: "sv-moe-g7-9",
  locator: "Math 7-9.pdf, page 37",
  excerpt: "Draw and use Venn diagrams to solve simple two-set problems.",
  verificationStatus: "VERIFIED" as const,
  evidenceSpecificity: "TOPIC_LEVEL" as const,
}];

const valid = {
  relationshipType: "SUPPORTING",
  coverage: "PARTIAL",
  depthRelation: "UNKNOWN",
  cognitiveDimensions: ["APPLICATION"],
  rationale: "The objective requires learners to draw and use Venn diagrams to solve two-set problems, matching the baseline expectation. No WAEC-side evidence is cited here, so this is reported as an inferred, not a directly verified, alignment.",
  objectiveEvidenceTerms: ["venn", "diagrams", "solve"],
  baselineEvidenceTerms: ["venn", "diagrams", "problems"],
  evidenceRefs: ["moe-math-p37"],
  confidence: 0.6,
  overfitToExamMechanics: false,
  prerequisiteGaps: [],
  authorityLabel: "AI_ASSESSED_ALIGNMENT",
  externalApprovalClaimed: false,
};

describe("P2-C AI authority separation", () => {
  it("accepts an evidence-grounded platform assessment", () => {
    expect(validateAiWaecAlignment({ raw: valid, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence })).toMatchObject({ authorityLabel: "AI_ASSESSED_ALIGNMENT", externalApprovalClaimed: false });
  });

  it("rejects a fabricated WAEC approval claim", () => {
    expect(() => validateAiWaecAlignment({ raw: { ...valid, rationale: "This WAEC-approved mapping proves official endorsement for the curriculum." }, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence })).toThrow("AI_EXTERNAL_AUTHORITY_CLAIM_PROHIBITED");
  });

  it("rejects an externalApprovalClaimed true payload at schema level", () => {
    expect(() => validateAiWaecAlignment({ raw: { ...valid, externalApprovalClaimed: true }, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence })).toThrow();
  });

  it("rejects title-only or ungrounded similarity", () => {
    expect(() => validateAiWaecAlignment({ raw: { ...valid, objectiveEvidenceTerms: ["mathematics", "topic"] }, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence })).toThrow("TITLE_ONLY_OR_UNGROUNDED_OBJECTIVE_MATCH");
  });

  it("rejects unofficial sources and invented evidence references", () => {
    expect(() => validateAiWaecAlignment({ raw: valid, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence: [{ ...evidence[0], canonicalUrl: "https://example-tutoring.test/waec" }] })).toThrow("ALIGNMENT_SOURCE_NOT_AUTHORITATIVE");
    expect(() => validateAiWaecAlignment({ raw: { ...valid, evidenceRefs: ["fabricated"] }, moeObjectiveWording: "Draw and use Venn diagrams to solve simple two-set problems", baselineExpectation: "Use Venn diagrams to solve set problems", evidence })).toThrow("AI_ALIGNMENT_FABRICATED_EVIDENCE_REF");
  });
});

describe("P2-C independent review routing", () => {
  it("routes important mappings to three independent specialties", () => {
    expect(buildAlignmentReviewTopology({ criticality: "CRITICAL", confidence: 0.8, relationshipType: "DIRECT", nationalImpact: true })).toEqual({ independentRoles: ["SUBJECT_MATTER", "WAEC_ALIGNMENT", "CURRICULUM_PEDAGOGY"], adjudicatorOnDisagreement: true, p2bPolicyFlag: "waecBaselineAlignment" });
  });

  it("uses a smaller independent topology for ordinary clear mappings", () => {
    expect(buildAlignmentReviewTopology({ criticality: "STANDARD", confidence: 0.95, relationshipType: "DIRECT", nationalImpact: false }).independentRoles).toEqual(["SUBJECT_MATTER", "WAEC_ALIGNMENT"]);
  });

  it("requires adjudication only for material disagreement", () => {
    expect(needsAlignmentAdjudication([{ relationshipType: "DIRECT", depthRelation: "MEETS_BASELINE", recommendation: "ACCEPT" }, { relationshipType: "PARTIAL", depthRelation: "BELOW_BASELINE", recommendation: "REJECT" }])).toBe(true);
    expect(needsAlignmentAdjudication([{ relationshipType: "DIRECT", depthRelation: "MEETS_BASELINE", recommendation: "ACCEPT" }, { relationshipType: "DIRECT", depthRelation: "MEETS_BASELINE", recommendation: "ACCEPT" }])).toBe(false);
  });

  it("reuses P2-B two-person policy without pretending the mapping is WAEC-authoritative", () => {
    const result = evaluateReviewPolicy({ subject: "MATHEMATICS", grade: 9, contentType: "lesson", requestedAuthority: "PLATFORM", riskBand: "STANDARD", provenanceComplete: true, evidenceCount: 1, waecBaselineAlignment: true, now: new Date("2026-08-14T12:00:00Z") });
    expect(result).toMatchObject({ requiredAuthority: "PLATFORM", requiredReviewCount: 2, blindSecondReview: true, evidenceRequired: true });
    expect(result.specialistCredentialTypes).toContain("STANDARDS_ALIGNMENT");
    expect(result.specialistCredentialTypes).not.toContain("WAEC_SUBJECT_REVIEW");
  });
});
