import { describe, expect, it } from "vitest";
import { buildCurriculumV2Contract, buildP5AHandoffContract } from "@/lib/curriculum/benchmarking/curriculumV2Contract";
import type { AlignmentEvidence } from "@/lib/curriculum/benchmarking/aiWaecAlignment";

/**
 * P2-C forensic remediation FIX 1: verifiedBaselineDepth must come only from
 * an actual assessed depth relation (CurriculumBaselineAlignment.depthRelation
 * or an equivalent explicit depth record), never inferred from
 * evidenceSpecificity or evidence presence. Evidence specificity answers
 * "what level of evidence exists"; it never answers "does LiberiaLearn meet
 * the baseline".
 */

const moeObjective = {
  id: "moe-1",
  code: "MOE.G9.MATH.SETS.TWO_SET_PROBLEMS",
  grade: 9,
  subject: "MATH",
  domain: "SETS",
  topic: "TWO-SET PROBLEMS",
  authoritativeWording: "Learners can solve simple two-set problems using Venn diagrams.",
  verificationStatus: "VERIFIED" as const,
};

const framework = { code: "WAEC.LIBERIA.LJHSCE", exam: "LJHSCE", level: "JUNIOR_SECONDARY", examAliases: [] };
const waecSubject = { subjectCode: "MATH", required: true, subjectGroup: "CORE" };

const topicLevelEvidence: AlignmentEvidence = {
  id: "waec-topic",
  authorityType: "WAEC_LIBERIA",
  canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
  sourceVersionId: "sv-waec",
  locator: "LJHSCE topic-level syllabus entry",
  excerpt: "Two-set problems using Venn diagrams are examined at Grade 9.",
  verificationStatus: "VERIFIED",
  evidenceSpecificity: "TOPIC_LEVEL",
};

const subjectLevelEvidence: AlignmentEvidence = {
  id: "waec-subject",
  authorityType: "WAEC_LIBERIA",
  canonicalUrl: "https://waecliberia.org.lr/ljhsce/",
  sourceVersionId: "sv-waec",
  locator: "LJHSCE subject table",
  excerpt: "Mathematics (210) is one of four compulsory LJHSCE subjects.",
  verificationStatus: "VERIFIED",
  evidenceSpecificity: "SUBJECT_LEVEL",
};

function buildContract(overrides: {
  evidence: AlignmentEvidence[];
  assessedDepthRelation?: Parameters<typeof buildCurriculumV2Contract>[0]["assessedDepthRelation"];
  evidenceSpecificity?: "FRAMEWORK_LEVEL" | "SUBJECT_LEVEL" | "TOPIC_LEVEL";
}) {
  return buildCurriculumV2Contract({
    moeObjective,
    framework,
    waecSubject,
    baselineCompetency: { verificationStatus: "PARTIAL", evidenceSpecificity: overrides.evidenceSpecificity },
    evidence: overrides.evidence,
    assessedDepthRelation: overrides.assessedDepthRelation ?? null,
    masteryTarget: null,
    extensionTarget: null,
    reviewState: "NOT_REVIEWED",
  });
}

describe("P2-C forensic remediation FIX 1: Curriculum V2 depth contract", () => {
  it("1. TOPIC_LEVEL evidence present + no depth assessment => UNKNOWN", () => {
    const contract = buildContract({ evidence: [topicLevelEvidence], evidenceSpecificity: "TOPIC_LEVEL" });
    expect(contract.evidenceSpecificity).toBe("TOPIC_LEVEL");
    expect(contract.verifiedBaselineDepth).toBe("UNKNOWN");
  });

  it("2. TOPIC_LEVEL evidence + actual assessed MEETS_BASELINE => MEETS_BASELINE", () => {
    const contract = buildContract({
      evidence: [topicLevelEvidence],
      evidenceSpecificity: "TOPIC_LEVEL",
      assessedDepthRelation: "MEETS_BASELINE",
    });
    expect(contract.verifiedBaselineDepth).toBe("MEETS_BASELINE");
  });

  it("3. SUBJECT_LEVEL evidence + no depth => UNKNOWN", () => {
    const contract = buildContract({ evidence: [subjectLevelEvidence], evidenceSpecificity: "SUBJECT_LEVEL" });
    expect(contract.evidenceSpecificity).toBe("SUBJECT_LEVEL");
    expect(contract.verifiedBaselineDepth).toBe("UNKNOWN");
  });

  it("4. SUBJECT_LEVEL evidence must never cause a definite depth, even with topic-level evidence also present elsewhere but no real assessment", () => {
    // Realistic worst case: both a topic-level AND subject-level evidence
    // item exist, but no CurriculumBaselineAlignment.depthRelation has
    // actually been assessed yet. Depth must still be UNKNOWN -- evidence
    // presence of any specificity never substitutes for a real assessment.
    const contract = buildContract({
      evidence: [topicLevelEvidence, subjectLevelEvidence],
      evidenceSpecificity: "TOPIC_LEVEL",
    });
    expect(contract.verifiedBaselineDepth).toBe("UNKNOWN");
  });

  it("5. No evidence => UNKNOWN", () => {
    const contract = buildContract({ evidence: [] });
    expect(contract.evidenceSpecificity).toBe("NONE");
    expect(contract.verifiedBaselineDepth).toBe("UNKNOWN");
  });

  it("passes through a real assessed BELOW_BASELINE relation honestly, not silently upgrading it", () => {
    const contract = buildContract({
      evidence: [topicLevelEvidence],
      evidenceSpecificity: "TOPIC_LEVEL",
      assessedDepthRelation: "BELOW_BASELINE",
    });
    expect(contract.verifiedBaselineDepth).toBe("BELOW_BASELINE");
  });

  it("prefers the persisted AssessmentBaselineCompetency.evidenceSpecificity over array-derived inference when both are present", () => {
    // Persisted field says SUBJECT_LEVEL even though the transient evidence
    // array happens to contain a TOPIC_LEVEL item -- the persisted,
    // individually-verified classification wins.
    const contract = buildContract({ evidence: [topicLevelEvidence], evidenceSpecificity: "SUBJECT_LEVEL" });
    expect(contract.evidenceSpecificity).toBe("SUBJECT_LEVEL");
  });
});

describe("P2-C Phase 16: P5-A handoff contract", () => {
  it("marks an active, non-revoked, non-superseded source as ACTIVE/FRESH", () => {
    const contract = buildP5AHandoffContract({
      sourceVersionId: "sv-1",
      sourceHash: "hash-1",
      validityStatus: "ACTIVE",
      rightsStatus: "RIGHTS_UNKNOWN",
      revoked: false,
      superseded: false,
    });
    expect(contract).toMatchObject({
      validityStatus: "ACTIVE",
      revocationState: "ACTIVE",
      staleMappingState: "FRESH",
    });
  });

  it("marks a revoked source REVOKED even if it would otherwise be ACTIVE", () => {
    const contract = buildP5AHandoffContract({
      sourceVersionId: "sv-1",
      sourceHash: "hash-1",
      validityStatus: "ACTIVE",
      rightsStatus: "RIGHTS_UNKNOWN",
      revoked: true,
      superseded: false,
    });
    expect(contract.revocationState).toBe("REVOKED");
  });

  it("marks a STALE source's mapping state STALE, not silently FRESH", () => {
    const contract = buildP5AHandoffContract({
      sourceVersionId: "sv-1",
      sourceHash: "hash-1",
      validityStatus: "STALE",
      rightsStatus: "RIGHTS_UNKNOWN",
      revoked: false,
      superseded: false,
    });
    expect(contract.staleMappingState).toBe("STALE");
  });

  it("marks a superseded source SUPERSEDED even when not explicitly revoked", () => {
    const contract = buildP5AHandoffContract({
      sourceVersionId: "sv-1",
      sourceHash: "hash-1",
      validityStatus: "SUPERSEDED",
      rightsStatus: "RIGHTS_UNKNOWN",
      revoked: false,
      superseded: true,
    });
    expect(contract.revocationState).toBe("SUPERSEDED");
    expect(contract.staleMappingState).toBe("UNKNOWN");
  });
});
