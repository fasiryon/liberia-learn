import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  LL_AEP_001,
  LL_GRADE_BANDS,
  LL_MASTERY_STATES,
  LL_SUBJECT_THRESHOLDS,
  LL_WEIGHTS_GRADES_1_3,
  LL_WEIGHTS_GRADES_4_12,
} from "@/lib/academic-policy/llAep001";
import {
  adoptGradingPolicy,
  buildReportCardDraft,
  buildReportCardView,
  classifyMastery,
  compareToBaseline,
  computeSubjectGrade,
  isFinalOfficialRecord,
  LL_AEP_001_GRADES_1_3,
  LL_AEP_001_GRADES_4_12,
  policyRef,
  publishReportCard,
  resolveGradingPolicy,
  tallyAttendance,
  validateGradingPolicy,
  type MasteryEvidenceSummary,
} from "@/lib/academic-records/v2";
import { calendar, entry, principal, SCHOOL, scope, YEAR } from "./fixtures";

/** Identical in the assessment (PR #193) and records (PR #194) branches. Update both copies together. */
const LL_AEP_001_SOURCE_DIGEST = "c69ddd89e743400707ddd6e26fcda4f9cd3a6dbb137531c30eed1279572d2561";

const adopt = (baseline = LL_AEP_001_GRADES_4_12) => adoptGradingPolicy(baseline, { schoolId: SCHOOL, approver: { userId: "principal-1", role: "PRINCIPAL", schoolId: SCHOOL }, version: "2027.1" });

describe("LL-AEP-001 policy baseline", () => {
  it("is the same byte-for-byte policy module in both PRs", () => {
    const source = readFileSync(path.resolve(__dirname, "../../lib/academic-policy/llAep001.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(source).digest("hex")).toBe(LL_AEP_001_SOURCE_DIGEST);
  });

  it("claims no government authority and is not activated", () => {
    expect(LL_AEP_001).toMatchObject({ policyFamily: "LL-AEP-001", version: "1.0.0", status: "PROPOSED_INSTITUTIONAL_BASELINE", activation: "NOT_ACTIVATED" });
    expect(LL_AEP_001.authorityOrder[0]).toBe("LIBERIALEARN_ACADEMIC_EXCELLENCE_STANDARD");
    expect(LL_AEP_001.authorityOrder[2]).toBe("MOE_WAEC_COMPATIBILITY");
  });

  it("encodes the LiberiaLearn bands, separate pass/proficiency thresholds and weights", () => {
    expect(LL_GRADE_BANDS.map((band) => `${band.label}:${band.minPercent}`)).toEqual(["A+:95", "A:90", "B+:85", "B:80", "C+:75", "C:70", "D:60", "F:0"]);
    expect(LL_SUBJECT_THRESHOLDS).toEqual({ passingPercent: 70, proficiencyTargetPercent: 80 });
    expect(LL_WEIGHTS_GRADES_4_12.map((group) => group.weightPercent)).toEqual([20, 15, 20, 20, 25]);
    expect(LL_WEIGHTS_GRADES_1_3.reduce((sum, group) => sum + group.weightPercent, 0)).toBe(100);
    expect(LL_MASTERY_STATES).toEqual(["NOT_YET_EVIDENCED", "EMERGING", "DEVELOPING", "SECURE", "ADVANCED"]);
  });

  it("ships valid institutional baselines that cannot grade until a school adopts them", () => {
    for (const baseline of [LL_AEP_001_GRADES_1_3, LL_AEP_001_GRADES_4_12]) {
      expect(validateGradingPolicy(baseline)).toEqual([]);
      expect(baseline.status).toBe("DRAFT");
      expect(() => computeSubjectGrade({ scope, policy: baseline, entries: [] })).toThrow("records_grading_policy_not_approved");
    }
    expect(validateGradingPolicy({ ...LL_AEP_001_GRADES_4_12, status: "APPROVED", approvedBy: { userId: "x", role: "ADMIN" } })).toContain("policy_institution_baseline_cannot_grade_directly");
    expect(() => adoptGradingPolicy(LL_AEP_001_GRADES_4_12, { schoolId: SCHOOL, approver: { userId: "t", role: "TEACHER", schoolId: SCHOOL }, version: "1" })).toThrow("records_adoption_requires_school_leadership");
    expect(() => adoptGradingPolicy(LL_AEP_001_GRADES_4_12, { schoolId: SCHOOL, approver: { userId: "p", role: "PRINCIPAL", schoolId: "school-2" }, version: "1" })).toThrow("records_adoption_requires_school_leadership");
    const adopted = adopt();
    expect(adopted).toMatchObject({ status: "APPROVED", scope: { kind: "SCHOOL", schoolId: SCHOOL } });
    expect(adopted.derivedFrom).toMatch(/^ll-aep-001-grading-g4-12@1\.0\.0#/);
  });

  it("resolves only a school's own approved policy for the grade, never a baseline", () => {
    const g4 = adopt();
    const g1 = adopt(LL_AEP_001_GRADES_1_3);
    expect(resolveGradingPolicy([LL_AEP_001_GRADES_4_12], SCHOOL, 7)).toBeNull();
    expect(resolveGradingPolicy([g4, g1], SCHOOL, 7)).toBe(g4);
    expect(resolveGradingPolicy([g4, g1], SCHOOL, 2)).toBe(g1);
    expect(resolveGradingPolicy([g4], "school-2", 7)).toBeNull();
    expect(() => resolveGradingPolicy([g4, { ...g4, version: "other" }], SCHOOL, 7)).toThrow("records_grading_policy_ambiguous");
  });
});

describe("LL-AEP-001 grading behaviour", () => {
  const ll = adopt();
  const llEntry = (category: Parameters<typeof entry>[0]["category"], earned: number, possible = 100, extra: Parameters<typeof entry>[0] = {}) => entry({ category, pointsEarned: earned, pointsPossible: possible, ...extra });

  it("weights the five Grades 4–12 groups 20/15/20/20/25 and pools legacy categories", () => {
    const result = computeSubjectGrade({ scope, policy: ll, entries: [
      llEntry("CLASSWORK", 90), llEntry("HOMEWORK", 80), llEntry("QUIZ", 70), llEntry("PROJECT", 85), llEntry("EXAM", 60),
    ] });
    // 0.2×90 + 0.15×80 + 0.2×70 + 0.2×85 + 0.25×60 = 76
    expect(result).toMatchObject({ status: "COMPLETE", percent: 76, label: "C+", passing: true, meetsProficiencyTarget: false });
  });

  it("separates passing (70) from proficiency (80) on the LiberiaLearn scale", () => {
    const at = (value: number) => computeSubjectGrade({ scope, policy: ll, entries: [llEntry("CLASSWORK", value), llEntry("HOMEWORK", value), llEntry("QUIZ", value), llEntry("PROJECT", value), llEntry("EXAM", value)] });
    expect(at(69.99)).toMatchObject({ label: "D", passing: false });
    expect(at(70)).toMatchObject({ label: "C", passing: true, meetsProficiencyTarget: false });
    expect(at(80)).toMatchObject({ label: "B", meetsProficiencyTarget: true });
    expect(at(95)).toMatchObject({ label: "A+" });
  });

  it("prevents a single examination from determining a period grade", () => {
    const result = computeSubjectGrade({ scope, policy: ll, entries: [llEntry("EXAM", 30), llEntry("EXAM", 0, 1, { status: "EXEMPT" }), llEntry("QUIZ", 0, 1, { status: "EXEMPT" })] });
    expect(result.blockers).toEqual(expect.arrayContaining(["single_assessment_dependency"]));
    expect(result.status).toBe("INCOMPLETE");
  });

  it("keeps every reassessment attempt in history and counts the policy's attempt", () => {
    const first = llEntry("QUIZ", 50, 100, { assessmentKey: "quiz-1", attemptNumber: 1 });
    const second = llEntry("QUIZ", 85, 100, { assessmentKey: "quiz-1", attemptNumber: 2 });
    const others = [llEntry("CLASSWORK", 80), llEntry("HOMEWORK", 80), llEntry("PROJECT", 80), llEntry("EXAM", 80)];
    const result = computeSubjectGrade({ scope, policy: ll, entries: [first, second, ...others] });
    expect(result.excluded).toEqual([{ entryId: first.entryId, reason: "superseded_by_reassessment" }]);
    expect(result.groups.find((group) => group.groupId === "QUIZZES_FORMATIVE")?.percent).toBe(85);
  });

  it("gives Grades 1–3 a developmental scheme with no tests or examinations", () => {
    const early = adopt(LL_AEP_001_GRADES_1_3);
    const earlyScope = { ...scope };
    const result = computeSubjectGrade({ scope: earlyScope, policy: early, entries: [
      entry({ category: "MASTERY_DEMONSTRATION", pointsEarned: 9, pointsPossible: 10 }),
      entry({ category: "GUIDED_ACTIVITY", pointsEarned: 8, pointsPossible: 10 }),
      entry({ category: "FOUNDATIONAL_CHECK", pointsEarned: 8, pointsPossible: 10 }),
      entry({ category: "TEACHER_OBSERVATION", pointsEarned: 7, pointsPossible: 10 }),
      entry({ category: "EXAM", pointsEarned: 2, pointsPossible: 10 }),
    ] });
    expect(result.excluded).toEqual([expect.objectContaining({ reason: "category_prohibited_by_policy" })]);
    expect(result.blockers).toContain("prohibited_category_present");
  });
});

describe("Learning mastery (separate from grades)", () => {
  const summary = (overrides: Partial<MasteryEvidenceSummary>): MasteryEvidenceSummary => ({
    objectiveId: "math-place-value", source: "VERIFIED_INDEPENDENT_EVIDENCE",
    independentItems: 0, independentPointsEarned: 0, independentPointsPossible: 0, independentOccasions: 0,
    verifiedTransferItems: 0, transferPointsEarned: 0, transferPointsPossible: 0, ...overrides,
  });

  it("classifies all five states and requires transfer for Advanced", () => {
    expect(classifyMastery(summary({})).state).toBe("NOT_YET_EVIDENCED");
    expect(classifyMastery(summary({ independentItems: 1, independentPointsEarned: 1, independentPointsPossible: 1, independentOccasions: 1 })).state).toBe("EMERGING");
    expect(classifyMastery(summary({ independentItems: 2, independentPointsEarned: 13, independentPointsPossible: 20, independentOccasions: 1 })).state).toBe("DEVELOPING");
    // Accurate on familiar items but only one occasion: not yet Secure.
    expect(classifyMastery(summary({ independentItems: 5, independentPointsEarned: 50, independentPointsPossible: 50, independentOccasions: 1 }))).toMatchObject({ state: "DEVELOPING", reasons: ["single_occasion_only"] });
    const secure = summary({ independentItems: 4, independentPointsEarned: 34, independentPointsPossible: 40, independentOccasions: 2 });
    expect(classifyMastery(secure)).toMatchObject({ state: "SECURE", reasons: ["transfer_not_yet_evidenced"] });
    expect(classifyMastery({ ...secure, verifiedTransferItems: 1, transferPointsEarned: 9, transferPointsPossible: 10 }).state).toBe("ADVANCED");
    expect(classifyMastery({ ...secure, verifiedTransferItems: 1, transferPointsEarned: 5, transferPointsPossible: 10 }).state).toBe("SECURE");
  });

  it("refuses summaries that are not verified independent evidence", () => {
    expect(() => classifyMastery({ ...summary({}), source: "PROVISIONAL" as never })).toThrow("records_mastery_requires_verified_independent_evidence");
    expect(() => classifyMastery(summary({ independentItems: 1, independentPointsEarned: 5, independentPointsPossible: 1 }))).toThrow("records_mastery_summary_invalid");
  });
});

describe("Official versus provisional records", () => {
  const ll = adopt();
  const incomplete = computeSubjectGrade({ scope, policy: ll, entries: [entry({ category: "CLASSWORK" }), entry({ category: "HOMEWORK", status: "MISSING", pointsEarned: null })] });
  const draft = buildReportCardDraft({
    recordId: "rc-p", kind: "PERIOD", calendar, periodId: "p1", student: { studentId: "stu-1", schoolId: SCHOOL },
    enrollment: { enrollmentId: "enr-1", studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, classIds: ["class-math"] },
    gradingPolicy: policyRef(ll), results: [incomplete], teacherComments: {}, attendance: tallyAttendance([]),
    masteryIndicators: [{ subject: "MATH", objectiveId: "Place value", label: "SKILL_MASTERY_INDICATOR_NOT_A_GRADE", level: "ADVANCED", evidenceTier: "MASTERY_ADMITTED_EVIDENCE", asOf: "2027-01-20T00:00:00.000Z" }],
    strengths: [], areasForImprovement: [], interventionPlan: [], yearEndDecision: { status: "NOT_APPLICABLE", outcome: null, decidedBy: null },
  });

  it("refuses to publish incomplete records as official but allows a labelled provisional record", () => {
    const args = { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods: [], principalComment: null, at: "2027-01-25T00:00:00.000Z" };
    expect(() => publishReportCard(draft, { ...args, publication: "OFFICIAL" })).toThrow(/records_report_subject_not_complete/);
    const { record } = publishReportCard(draft, { ...args, publication: "PROVISIONAL" });
    expect(record.publication).toBe("PROVISIONAL");
    expect(isFinalOfficialRecord(record)).toBe(false);
    const view = buildReportCardView(record, { audience: "GUARDIAN", studentName: "x", schoolName: "y", periodName: "z", yearLabel: "w", gradeLevel: 7 });
    expect(view.watermark).toBe("PROVISIONAL — NOT A FINAL ACADEMIC RECORD");
    expect(view.mastery.rows[0].level).toBe("Advanced");
  });
});

describe("Calendar baseline", () => {
  it("reports the three-term baseline without forcing it", () => {
    expect(compareToBaseline(calendar)).toEqual({ matchesBaseline: false, reportingPeriods: 2, baselineReportingTerms: 3 });
    const threeTerms = { ...calendar, periods: [
      { ...calendar.periods[0], periodId: "t1", name: "Term 1", endDate: "2026-12-15T00:00:00.000Z" },
      { periodId: "t2", name: "Term 2", order: 2, startDate: "2027-01-05T00:00:00.000Z", endDate: "2027-04-02T00:00:00.000Z", issuesReport: true },
      { periodId: "t3", name: "Term 3", order: 3, startDate: "2027-04-19T00:00:00.000Z", endDate: "2027-06-30T00:00:00.000Z", issuesReport: true },
    ] };
    expect(compareToBaseline(threeTerms).matchesBaseline).toBe(true);
  });
});
