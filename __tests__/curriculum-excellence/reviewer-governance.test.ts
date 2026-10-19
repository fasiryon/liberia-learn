// Curriculum Excellence Standard V1: the AI instructional reviewer is advisory. It may not review
// its own changes, approve, publish, claim qualification, or survive a change to the revision.
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseCandidateLessonV2 } from "@/lib/curriculum/v2/parse";
import { assertNativeCurriculumV2Approval, NativeCurriculumGovernanceError } from "@/lib/curriculum/v2/governance";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";
import {
  assertNoProhibitedClaims, assertReportMatchesRevision, assessReviewerIndependence, buildInstructionalReview,
  InstructionalReviewError, validateJudgment, type AgentIdentity, type RevisionInput,
} from "@/lib/curriculum/excellence/instructionalReviewer";

const candidate = parseCandidateLessonV2(JSON.parse(readFileSync("curriculum/v2/g4-math/candidates/place-value.json", "utf8")));
const objectiveId = candidate.scenes.flatMap((scene) => scene.objectiveIds)[0];
const assessment = {
  items: [{
    objectiveId,
    distractorMisconceptions: { "0": candidate.misconceptions[0]?.id ?? "mc-x" },
    verification: { kind: "DIGIT_VALUE", number: "4,582", digit: "5" },
    item: { id: "fixture-1", options: ["5", "500", "50"], correctIndex: 1 },
  }],
};

const generator: AgentIdentity = { kind: "AI", agentId: "generator:curriculum-v2", modelFamily: "family-a", sessionId: "gen-session" };
const reviewer: AgentIdentity = { kind: "AI", agentId: "reviewer:excellence", modelFamily: "family-b", sessionId: "review-session" };

const revision = (overrides: Partial<RevisionInput> = {}): RevisionInput => ({
  contentKey: "fixture-g4-place-value", subject: "MATH", grade: 4, candidate, assessment,
  source: { gitCommit: null, candidatePath: "curriculum/v2/g4-math/candidates/place-value.json", assessmentPath: null },
  authors: [generator],
  ...overrides,
});

describe("AI reviewer may not review or approve its own changes", () => {
  it("refuses to review a revision it authored (same agent)", () => {
    expect(() => buildInstructionalReview({ reviewer, revision: revision({ authors: [reviewer] }) }))
      .toThrowError(/SELF_REVIEW_PROHIBITED/);
  });

  it("refuses when the reviewer authored a fix inside the revision (mixed authorship)", () => {
    expect(() => buildInstructionalReview({ reviewer, revision: revision({ authors: [generator, { ...reviewer, agentId: reviewer.agentId }] }) }))
      .toThrowError(/SELF_REVIEW_PROHIBITED/);
  });

  it("refuses a different agent id in the same session (a renamed self)", () => {
    const renamed: AgentIdentity = { ...reviewer, agentId: "reviewer:renamed" };
    expect(() => buildInstructionalReview({ reviewer, revision: revision({ authors: [renamed] }) }))
      .toThrowError(/SELF_REVIEW_PROHIBITED/);
  });

  it("refuses unknown authorship rather than assuming independence", () => {
    expect(() => buildInstructionalReview({ reviewer, revision: revision({ authors: [] }) })).toThrowError(/AUTHORSHIP_UNKNOWN/);
  });

  it("allows same-model-family review as advice but never counts it as independent", () => {
    const sameFamily: AgentIdentity = { ...reviewer, modelFamily: "family-a" };
    const independence = assessReviewerIndependence(sameFamily, [generator]);
    expect(independence).toMatchObject({ selfAuthored: false, independent: false, countsAsIndependentReview: false });
    expect(independence.reasons).toContain("SAME_MODEL_FAMILY:family-a");
    const report = buildInstructionalReview({ reviewer: sameFamily, revision: revision() });
    expect(report.independence.countsAsIndependentReview).toBe(false);
  });

  it("marks a reviewer-authored plan as unreviewed instead of reviewing it", () => {
    const report = buildInstructionalReview({
      reviewer,
      revision: revision({ plan: { planId: "plan-1", authors: [reviewer], tasks: [] } }),
    });
    expect(report.projectedBlueprintWithPlan).toMatchObject({ planAuthoredByReviewer: true, planReviewStatus: "UNREVIEWED_REQUIRES_INDEPENDENT_REVIEW" });
  });

  it("only accepts AI reviewer identities (a human review is a different, governed path)", () => {
    expect(() => assessReviewerIndependence({ kind: "HUMAN", agentId: "teacher-1" }, [generator])).toThrowError(/AI_REVIEWER_ONLY/);
  });
});

describe("AI review cannot bypass governed approval or publication", () => {
  const report = buildInstructionalReview({ reviewer, revision: revision() });

  it("has no approve outcome and declares no authority", () => {
    expect(["REVISE_BEFORE_HUMAN_REVIEW", "READY_FOR_QUALIFIED_HUMAN_REVIEW"]).toContain(report.outcome);
    expect(report).toMatchObject({
      authority: "ADVISORY_ONLY", mayApprove: false, mayPublish: false,
      humanQualificationClaimed: false, officialApprovalClaimed: false, candidateOnly: true,
    });
    expect(JSON.stringify(report)).not.toMatch(/"(approved|published|released|moeApproved)"\s*:\s*true/);
  });

  it("cannot be used as the approval basis for native Curriculum V2", () => {
    const base = {
      native: true, writersEnabled: true, eventType: "APPROVED", hasQualification: true,
      reviewAuthority: "PLATFORM", nativeSnapshotSchemaVersion: 2,
    };
    // The report's own authority, an AI actor, or an AI identity posing as a user are all refused.
    expect(() => assertNativeCurriculumV2Approval({ ...base, approvalBasis: report.authority, actorType: "AI", actorUserId: null }))
      .toThrow(NativeCurriculumGovernanceError);
    expect(() => assertNativeCurriculumV2Approval({ ...base, approvalBasis: "AI_PLATFORM_REVIEW", actorType: "USER", actorUserId: reviewer.agentId }))
      .toThrow(/REQUIRES_HUMAN_REVIEW/);
    expect(() => assertNativeCurriculumV2Approval({ ...base, approvalBasis: "HUMAN_REVIEW", actorType: "AI", actorUserId: reviewer.agentId }))
      .toThrow(/REQUIRES_QUALIFIED_HUMAN/);
  });

  it("is void for any other revision and detects tampering", () => {
    expect(() => assertReportMatchesRevision(report, candidate, assessment)).not.toThrow();
    const edited = { ...candidate, title: `${candidate.title} (edited)` } as CandidateLessonV2;
    expect(() => assertReportMatchesRevision(report, edited, assessment)).toThrowError(/REVISION_STALE/);
    expect(() => assertReportMatchesRevision(report, candidate, { items: [] })).toThrowError(/REVISION_STALE/);
    const forged = { ...report, outcome: "READY_FOR_QUALIFIED_HUMAN_REVIEW" as const, findings: [] };
    expect(() => assertReportMatchesRevision(forged, candidate, assessment)).toThrowError(/REPORT_TAMPERED/);
  });

  it("refuses a revision whose hash differs from the one it was asked to review", () => {
    expect(() => buildInstructionalReview({ reviewer, revision: revision({ expectedCandidateSha256: "0".repeat(64) }) }))
      .toThrowError(/REVISION_HASH_MISMATCH/);
  });

  it("the excellence modules import no database, governance writer, release or publication code", () => {
    const dir = "lib/curriculum/excellence";
    const forbidden = [/@\/lib\/db\b/, /@prisma\/client/, /governanceWriter/, /publishedReleases/, /releaseManifests/, /compatibilityRelease/, /\/mutations\//, /learningDecisionStore/, /routedCompletion/];
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(path.join(dir, file), "utf8");
      const imports = source.match(/from\s+"[^"]+"/g) ?? [];
      for (const pattern of forbidden) expect(imports.filter((line) => pattern.test(line)), `${file} imports ${pattern}`).toEqual([]);
      expect(source, `${file} writes files`).not.toMatch(/writeFileSync|appendFileSync|\$executeRaw|\.(create|createMany|update|updateMany|upsert|delete)\(\{/);
    }
  });
});

describe("findings must be evidence-backed and free of authority claims", () => {
  const documents = { CANDIDATE: candidate, ASSESSMENT: assessment };
  const base = {
    id: "ai-1", code: "TEST", criterionId: "LM-RSN-1", severity: "MAJOR" as const,
    statement: "The lesson collects no unscaffolded explanation.", recommendation: "Add one.", confidence: 0.8,
  };

  it("accepts a quote that is in the revision and pins its value hash", () => {
    const quote = candidate.title.slice(0, 12);
    const finding = validateJudgment(documents, { ...base, evidence: [{ document: "CANDIDATE", pointer: "/title", quote }] });
    expect(finding).toMatchObject({ method: "AI_JUDGMENT", requiresHumanConfirmation: true, layer: "LIBERIALEARN_MASTERY" });
    expect(finding.evidence[0].valueSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects fabricated quotes, unresolved pointers and evidence-free findings", () => {
    expect(() => validateJudgment(documents, { ...base, evidence: [{ document: "CANDIDATE", pointer: "/title", quote: "text that is not in the lesson" }] }))
      .toThrowError(/EVIDENCE_QUOTE_NOT_IN_REVISION/);
    expect(() => validateJudgment(documents, { ...base, evidence: [{ document: "CANDIDATE", pointer: "/scenes/999/title", quote: "x" }] }))
      .toThrowError(/EVIDENCE_POINTER_UNRESOLVED/);
    expect(() => validateJudgment(documents, { ...base, evidence: [] })).toThrowError(/FINDING_EVIDENCE_REQUIRED/);
    expect(() => validateJudgment(documents, { ...base, criterionId: "XX-1", evidence: [{ document: "CANDIDATE", pointer: "/title", quote: candidate.title }] }))
      .toThrowError(/UNKNOWN_CRITERION/);
  });

  it.each([
    "I approve this lesson for classroom use.",
    "This revision is approved.",
    "The content is MOE-approved.",
    "Aligned and WAEC endorsed.",
    "The lesson is ready for publication.",
    "As a qualified teacher, I find the sequence sound.",
    "I am an examiner and this meets the standard.",
    "This lesson works.",
  ])("refuses the claim %j", (claim) => {
    expect(() => assertNoProhibitedClaims(claim, "test")).toThrowError(/PROHIBITED_CLAIM/);
    expect(() => validateJudgment(documents, { ...base, statement: claim, evidence: [{ document: "CANDIDATE", pointer: "/title", quote: candidate.title }] }))
      .toThrowError(/PROHIBITED_CLAIM/);
  });

  it("allows saying that human approval is still required", () => {
    expect(() => assertNoProhibitedClaims("Qualified human approval is required before release; MOE approval is not claimed.", "test")).not.toThrow();
  });
});
