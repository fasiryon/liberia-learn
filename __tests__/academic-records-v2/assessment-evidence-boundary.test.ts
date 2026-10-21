import { describe, expect, it } from "vitest";
import {
  adoptGradingPolicy,
  classifyMastery,
  computeSubjectGrade,
  LL_AEP_001_GRADES_4_12,
  masterySummaryFromEvidence,
  toGradeEntry,
  type AssessmentEvidenceForRecords,
} from "@/lib/academic-records/v2";
import { SCHOOL, scope } from "./fixtures";

function evidence(overrides: Partial<AssessmentEvidenceForRecords> = {}, scoring: Partial<AssessmentEvidenceForRecords["scoring"]> = {}): AssessmentEvidenceForRecords {
  return {
    evidenceId: `ev-${Math.random().toString(36).slice(2)}`, tier: "VERIFIED_ASSESSMENT_EVIDENCE",
    scope: { schoolId: SCHOOL, studentId: "stu-1" }, pins: { itemId: "item-1", releaseId: "rel-1" },
    attempt: { attemptId: "att-1", sessionId: "ses-1" }, objectiveIds: ["math-place-value"],
    delivery: { official: true, purpose: "SUMMATIVE", itemContext: "REHEARSED" }, independence: "INDEPENDENT",
    ...overrides,
    scoring: { status: "SCORED", scorerAuthority: "SERVER_KEYED", points: 8, maxPoints: 10, moderation: null, ...scoring },
  };
}

const args = { scope, classId: "class-math", category: "EXAM" as const, revokedReleaseIds: [] as string[] };

describe("Assessment evidence → official academic records boundary", () => {
  it("turns only official, verified, authoritative, independent evidence into a scored entry", () => {
    expect(toGradeEntry(evidence(), args)).toMatchObject({ status: "SCORED", pointsEarned: 8, pointsPossible: 10, scoreAuthority: "SERVER_KEYED" });
    expect(toGradeEntry(evidence({ tier: "MASTERY_ADMITTED_EVIDENCE" }), args)).toMatchObject({ status: "SCORED" });
  });

  it("never treats raw observations, provisional AI feedback, unofficial or revoked evidence as official", () => {
    expect(toGradeEntry(evidence({ tier: "RAW_OBSERVATION" }), args)).toMatchObject({ excluded: true, reason: "raw_observation_is_not_a_score" });
    expect(toGradeEntry(evidence({ tier: "PROVISIONAL_FEEDBACK" }, { scorerAuthority: "AI_SUGGESTION" }), args)).toMatchObject({ reason: "provisional_feedback_is_not_official" });
    expect(toGradeEntry(evidence({ delivery: { official: false, purpose: "FORMATIVE", itemContext: "REHEARSED" } }), args)).toMatchObject({ reason: "delivery_not_official" });
    expect(toGradeEntry(evidence({}, { scorerAuthority: "AI_SUGGESTION" }), args)).toMatchObject({ reason: "scorer_not_authoritative" });
    expect(toGradeEntry(evidence(), { ...args, revokedReleaseIds: ["rel-1"] })).toMatchObject({ reason: "release_revoked" });
    expect(toGradeEntry(evidence({}, { status: "PENDING_HUMAN_MODERATION", points: null, scorerAuthority: null }), args)).toMatchObject({ reason: "not_scored" });
  });

  it("holds unreconciled second marking and assisted official responses for a teacher", () => {
    const moderated = { scorerAuthority: "HUMAN_MODERATOR", moderation: { secondMarkerRequired: true, marking: "SINGLE" } };
    expect(toGradeEntry(evidence({}, moderated), args)).toMatchObject({ reason: "second_marking_unreconciled" });
    expect(toGradeEntry(evidence({}, { ...moderated, moderation: { secondMarkerRequired: true, marking: "RECONCILED" } }), args)).toMatchObject({ status: "SCORED", scoreAuthority: "HUMAN_MODERATOR" });
    expect(toGradeEntry(evidence({ independence: "ASSISTED" }), args)).toMatchObject({ status: "PENDING_MODERATION", pointsEarned: null });
  });

  it("treats UNVERIFIED independence (assessment evidence 1.1.0) like assistance: teacher review, never mastery", () => {
    expect(toGradeEntry(evidence({ independence: "UNVERIFIED" }), args)).toMatchObject({ status: "PENDING_MODERATION", pointsEarned: null, scoreAuthority: null });
    const unverified = [1, 2, 3].map((n) => evidence({ independence: "UNVERIFIED", attempt: { attemptId: `u${n}`, sessionId: `us${n}` }, pins: { itemId: `item-u${n}`, releaseId: "rel-1" } }, { points: 10 }));
    expect(masterySummaryFromEvidence(unverified, { scope: { schoolId: SCHOOL, studentId: "stu-1" }, objectiveId: "math-place-value", revokedReleaseIds: [] }))
      .toMatchObject({ independentItems: 0, independentOccasions: 0, independentPointsEarned: 0 });
  });

  it("refuses evidence from another school or student", () => {
    expect(() => toGradeEntry(evidence({ scope: { schoolId: "school-2", studentId: "stu-1" } }), args)).toThrow("records_evidence_scope_mismatch");
    expect(() => toGradeEntry(evidence({ scope: { schoolId: SCHOOL, studentId: "stu-2" } }), args)).toThrow("records_evidence_scope_mismatch");
  });

  it("keeps grades and mastery separate: assisted evidence can sit in a grade review queue but never in mastery", () => {
    const policy = adoptGradingPolicy(LL_AEP_001_GRADES_4_12, { schoolId: SCHOOL, approver: { userId: "p", role: "PRINCIPAL", schoolId: SCHOOL }, version: "1" });
    const entries = [evidence({ independence: "ASSISTED" })].map((item) => toGradeEntry(item, args)).filter((item): item is Exclude<typeof item, { excluded: true }> => !("excluded" in item));
    expect(computeSubjectGrade({ scope, policy, entries }).blockers).toContain("scores_pending_moderation");
    const all = [
      evidence({ attempt: { attemptId: "a1", sessionId: "s1" } }),
      evidence({ attempt: { attemptId: "a2", sessionId: "s2" }, pins: { itemId: "item-2", releaseId: "rel-1" } }),
      evidence({ attempt: { attemptId: "a3", sessionId: "s2" }, pins: { itemId: "item-3", releaseId: "rel-1" } }, { points: 9 }),
      evidence({ independence: "ASSISTED", attempt: { attemptId: "a4", sessionId: "s3" } }, { points: 10 }),
      evidence({ tier: "PROVISIONAL_FEEDBACK", attempt: { attemptId: "a5", sessionId: "s4" } }, { points: 10 }),
      evidence({ tier: "RAW_OBSERVATION", attempt: { attemptId: "a6", sessionId: "s5" } }),
    ];
    const summary = masterySummaryFromEvidence(all, { scope: { schoolId: SCHOOL, studentId: "stu-1" }, objectiveId: "math-place-value", revokedReleaseIds: [] });
    expect(summary).toMatchObject({ independentItems: 3, independentOccasions: 2, independentPointsEarned: 25, verifiedTransferItems: 0 });
    expect(classifyMastery(summary).state).toBe("SECURE");
    const transfer = [...all, evidence({ attempt: { attemptId: "a7", sessionId: "s6" }, pins: { itemId: "t-1", releaseId: "rel-1" }, delivery: { official: true, purpose: "TRANSFER", itemContext: "NEW" } }, { points: 9 })];
    expect(classifyMastery(masterySummaryFromEvidence(transfer, { scope: { schoolId: SCHOOL, studentId: "stu-1" }, objectiveId: "math-place-value", revokedReleaseIds: [] })).state).toBe("ADVANCED");
  });

  it("never credits one multi-objective score toward mastery of each objective", () => {
    const mixed = [1, 2, 3].map((n) => evidence({ attempt: { attemptId: `m${n}`, sessionId: `ms${n}` }, pins: { itemId: `mixed-${n}`, releaseId: "rel-1" }, objectiveIds: ["math-place-value", "math-rounding"] }, { points: 10 }));
    for (const objectiveId of ["math-place-value", "math-rounding"]) {
      expect(masterySummaryFromEvidence(mixed, { scope: { schoolId: SCHOOL, studentId: "stu-1" }, objectiveId, revokedReleaseIds: [] })).toMatchObject({ independentItems: 0, independentPointsEarned: 0 });
    }
    const single = evidence({ attempt: { attemptId: "s1", sessionId: "ss1" } });
    expect(masterySummaryFromEvidence([single, ...mixed], { scope: { schoolId: SCHOOL, studentId: "stu-1" }, objectiveId: "math-place-value", revokedReleaseIds: [] })).toMatchObject({ independentItems: 1, independentPointsEarned: 8 });
  });
});
