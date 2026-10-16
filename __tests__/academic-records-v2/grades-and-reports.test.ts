import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { OfficialReportCard } from "@/components/records/OfficialReportCard";
import {
  amendPublishedReportCard,
  buildReportCardDraft,
  buildReportCardView,
  calendarFromAcademicYear,
  canViewReportCard,
  computeSubjectGrade,
  hashGradingPolicy,
  legacyAssignmentScoreAuthority,
  lockPeriod,
  policyRef,
  publishReportCard,
  tallyAttendance,
  validateCalendar,
  validateGradingPolicy,
  verifyPeriod,
  type ClassSubjectPeriod,
  type SubjectGradeResult,
} from "@/lib/academic-records/v2";
import { admin, calendar, entry, policy, principal, SCHOOL, scope, teacher, YEAR } from "./fixtures";

describe("Configurable academic calendars", () => {
  it("accepts any number of reporting periods (here two semesters, not four quarters)", () => {
    expect(validateCalendar(calendar)).toEqual([]);
    const six = { ...calendar, periods: Array.from({ length: 6 }, (_, index) => ({
      periodId: `m${index + 1}`, name: `Marking period ${index + 1}`, order: index + 1, issuesReport: true,
      startDate: new Date(Date.UTC(2026, 8 + index, 2)).toISOString(), endDate: new Date(Date.UTC(2026, 8 + index, 25)).toISOString(),
    })) };
    expect(validateCalendar(six)).toEqual([]);
  });

  it("rejects overlapping, out-of-year and empty period structures", () => {
    const overlap = { ...calendar, periods: [calendar.periods[0], { ...calendar.periods[1], startDate: "2027-01-10T00:00:00.000Z" }] };
    expect(validateCalendar(overlap).map((issue) => issue.code)).toContain("calendar_periods_overlap");
    const outside = { ...calendar, periods: [{ ...calendar.periods[0], startDate: "2026-08-01T00:00:00.000Z" }] };
    expect(validateCalendar(outside).map((issue) => issue.code)).toContain("calendar_period_outside_year");
    expect(validateCalendar({ ...calendar, periods: [] }).map((issue) => issue.code)).toContain("calendar_periods_required");
  });

  it("adapts existing AcademicYear/Term rows and refuses terms of another year", () => {
    const year = { id: YEAR, schoolId: SCHOOL, yearLabel: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-15") };
    const terms = [
      { id: "t2", academicYearId: YEAR, name: "Term 2", startDate: new Date("2027-02-01"), endDate: new Date("2027-06-30") },
      { id: "t1", academicYearId: YEAR, name: "Term 1", startDate: new Date("2026-09-01"), endDate: new Date("2027-01-20") },
    ];
    const adapted = calendarFromAcademicYear(year, terms, { reportingTermIds: "ALL" });
    expect(adapted.periods.map((period) => period.periodId)).toEqual(["t1", "t2"]);
    expect(validateCalendar(adapted)).toEqual([]);
    expect(() => calendarFromAcademicYear(year, [{ ...terms[0], academicYearId: "other" }], { reportingTermIds: "ALL" })).toThrow("records_term_not_in_academic_year");
  });
});

describe("Versioned grading policy", () => {
  it("validates weights, scale and MOE provenance without assuming a national formula", () => {
    expect(validateGradingPolicy(policy)).toEqual([]);
    expect(validateGradingPolicy({ ...policy, categories: [{ category: "EXAM", weightPercent: 60 }] })).toContain("policy_weights_must_sum_to_100");
    expect(validateGradingPolicy({ ...policy, source: { kind: "MOE_DIRECTIVE", reference: "", attestedBy: null } })).toContain("policy_moe_source_requires_reference_and_attestation");
    expect(validateGradingPolicy({ ...policy, approvedBy: null })).toContain("policy_approval_required");
    expect(hashGradingPolicy(policy)).not.toBe(hashGradingPolicy({ ...policy, version: "2026.2" }));
  });
});

describe("Official grade calculation", () => {
  it("requires an approved policy of the same school", () => {
    expect(() => computeSubjectGrade({ scope, policy: null, entries: [] })).toThrow("records_grading_policy_required");
    expect(() => computeSubjectGrade({ scope, policy: { ...policy, status: "DRAFT" }, entries: [] })).toThrow("records_grading_policy_not_approved");
    expect(() => computeSubjectGrade({ scope, policy: { ...policy, schoolId: "school-2" }, entries: [] })).toThrow("records_grading_policy_school_mismatch");
  });

  it("reports NO_EVIDENCE (null), never 0%, when nothing was graded", () => {
    const result = computeSubjectGrade({ scope, policy, entries: [] });
    expect(result).toMatchObject({ status: "NO_EVIDENCE", percent: null, label: null, passing: null });
  });

  it("normalizes each entry to its own scale and applies category weights", () => {
    const result = computeSubjectGrade({ scope, policy, entries: [
      entry({ category: "CLASSWORK", pointsEarned: 9, pointsPossible: 10 }),
      entry({ category: "QUIZ", pointsEarned: 15, pointsPossible: 20 }),
      entry({ category: "EXAM", pointsEarned: 80, pointsPossible: 100 }),
    ] });
    // 0.3*90 + 0.2*75 + 0.5*80 = 82
    expect(result).toMatchObject({ status: "COMPLETE", percent: 82, label: "B", passing: true });
  });

  it("does not combine raw scores from incompatible scales", () => {
    // A raw average of 9 and 80 would be 44.5; per-entry normalization gives 85.
    const result = computeSubjectGrade({ scope, policy, entries: [
      entry({ category: "EXAM", pointsEarned: 9, pointsPossible: 10 }),
      entry({ category: "EXAM", pointsEarned: 80, pointsPossible: 100 }),
    ] });
    expect(result.percent).toBeCloseTo(80.9, 1);
    const equal = computeSubjectGrade({ scope, policy: { ...policy, withinCategory: "EQUAL" }, entries: [
      entry({ category: "EXAM", pointsEarned: 9, pointsPossible: 10 }),
      entry({ category: "EXAM", pointsEarned: 80, pointsPossible: 100 }),
    ] });
    expect(equal.percent).toBe(85);
  });

  it("distinguishes missing, exempt, late, incomplete and pending work", () => {
    const missing = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({}), entry({ status: "MISSING", pointsEarned: null })] });
    expect(missing).toMatchObject({ status: "INCOMPLETE", percent: 80 });
    expect(missing.blockers).toContain("missing_work_unresolved");

    const confirmedZero = computeSubjectGrade({ scope, policy: { ...policy, missingWork: "ZERO_WHEN_TEACHER_CONFIRMED" }, entries: [entry({}), entry({}), entry({ status: "MISSING", pointsEarned: null, teacherConfirmedMissing: true })] });
    expect(confirmedZero).toMatchObject({ status: "COMPLETE", percent: 53.3 });

    const exempt = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({}), entry({ status: "EXEMPT", pointsEarned: null })] });
    expect(exempt).toMatchObject({ status: "COMPLETE", percent: 80 });
    expect(exempt.excluded).toEqual([expect.objectContaining({ reason: "exempt" })]);

    const late = computeSubjectGrade({ scope, policy, entries: [entry({ pointsEarned: 10 }), entry({ status: "LATE", pointsEarned: 10, daysLate: 2 })] });
    expect(late.percent).toBe(90); // second entry penalised 20%

    const incomplete = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({}), entry({ status: "INCOMPLETE", pointsEarned: null })] });
    expect(incomplete.blockers).toContain("incomplete_work_unresolved");
    const pending = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({}), entry({ status: "PENDING_MODERATION", pointsEarned: null })] });
    expect(pending.blockers).toContain("scores_pending_moderation");
  });

  it("excludes unmoderated and auto-released AI scores from official grades", () => {
    const result = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({}), entry({ pointsEarned: 10, scoreAuthority: "AI_AUTO_RELEASED" })] });
    expect(result).toMatchObject({ status: "INCOMPLETE", percent: 80 });
    expect(result.blockers).toContain("unmoderated_ai_scores_present");
    expect(legacyAssignmentScoreAuthority({ score: 90, teacherApproved: false, autoReleasedAt: new Date(), aiGrade: 90, gradedBy: null })).toBe("AI_AUTO_RELEASED");
    expect(legacyAssignmentScoreAuthority({ score: 90, teacherApproved: true, autoReleasedAt: null, aiGrade: 90, gradedBy: "t1" })).toBe("TEACHER");
    expect(legacyAssignmentScoreAuthority({ score: null, teacherApproved: false, autoReleasedAt: null, aiGrade: 90, gradedBy: null })).toBeNull();
  });

  it("rejects entries from another school, class, subject or period instead of mixing them", () => {
    for (const leak of [{ schoolId: "school-2" }, { classId: "class-other" }, { subject: "ENGLISH" }, { periodId: "p2" }, { studentId: "stu-2" }]) {
      expect(() => computeSubjectGrade({ scope, policy, entries: [entry(leak)] })).toThrow("records_entry_scope_mismatch");
    }
  });

  it("marks a grade incomplete when the policy forbids renormalizing an empty weighted category", () => {
    const result = computeSubjectGrade({ scope, policy: { ...policy, emptyCategory: "INCOMPLETE" }, entries: [entry({}), entry({})] });
    expect(result.blockers).toContain("weighted_category_without_evidence");
  });
});

function lockedPeriod(results: SubjectGradeResult[]): ClassSubjectPeriod {
  const open: ClassSubjectPeriod = { schoolId: SCHOOL, academicYearId: YEAR, periodId: "p1", classId: "class-math", subject: "MATH", state: "OPEN", verifiedBy: null, lockedBy: null, verifiedResultsDigest: null };
  const verified = verifyPeriod(open, { actor: teacher, results, at: "2027-01-21T00:00:00.000Z" }).period;
  return lockPeriod(verified, { actor: principal, currentResults: results, at: "2027-01-22T00:00:00.000Z" }).period;
}

function completeResult() {
  return computeSubjectGrade({ scope, policy, entries: [entry({ category: "EXAM", pointsEarned: 85, pointsPossible: 100 }), entry({ category: "CLASSWORK" })] });
}

function draft(results = [completeResult()]) {
  return buildReportCardDraft({
    recordId: "rc-1", kind: "PERIOD", calendar, periodId: "p1",
    student: { studentId: "stu-1", schoolId: SCHOOL },
    enrollment: { enrollmentId: "enr-1", studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, classIds: ["class-math"] },
    gradingPolicy: policyRef(policy), results, teacherComments: { MATH: "Compares decimals confidently." },
    attendance: tallyAttendance([{ status: "PRESENT" }, { status: "LATE" }, { status: "EXCUSED" }, { status: "ABSENT" }]),
    masteryIndicators: [{ subject: "MATH", objectiveId: "Compare decimals to thousandths", label: "SKILL_MASTERY_INDICATOR_NOT_A_GRADE", level: "DEVELOPING", evidenceTier: "MASTERY_ADMITTED_EVIDENCE", asOf: "2027-01-20T00:00:00.000Z" }],
    strengths: ["Explains reasoning clearly"], areasForImprovement: ["Ordering decimals with different lengths"], interventionPlan: ["Two weekly retrieval sessions on decimal order"],
    yearEndDecision: { status: "NOT_APPLICABLE", outcome: null, decidedBy: null },
  });
}

describe("Grading-period verification and lock", () => {
  it("requires the assigned teacher to verify complete results and leadership to lock", () => {
    const results = [completeResult()];
    const open: ClassSubjectPeriod = { schoolId: SCHOOL, academicYearId: YEAR, periodId: "p1", classId: "class-math", subject: "MATH", state: "OPEN", verifiedBy: null, lockedBy: null, verifiedResultsDigest: null };
    expect(() => verifyPeriod(open, { actor: { ...teacher, classIds: ["class-other"] }, results, at: "2027-01-21T00:00:00.000Z" })).toThrow("records_verify_requires_assigned_teacher");
    const incomplete = computeSubjectGrade({ scope, policy, entries: [entry({}), entry({ status: "MISSING", pointsEarned: null })] });
    expect(() => verifyPeriod(open, { actor: teacher, results: [incomplete], at: "2027-01-21T00:00:00.000Z" })).toThrow(/records_verify_blocked/);
    expect(() => lockPeriod(open, { actor: principal, currentResults: results, at: "2027-01-22T00:00:00.000Z" })).toThrow("records_lock_requires_teacher_verification");
    const verified = verifyPeriod(open, { actor: teacher, results, at: "2027-01-21T00:00:00.000Z" });
    expect(verifyPeriod(verified.period, { actor: teacher, results, at: "2027-01-21T01:00:00.000Z" }).audit).toBeNull(); // idempotent
    expect(() => lockPeriod(verified.period, { actor: teacher, currentResults: results, at: "2027-01-22T00:00:00.000Z" })).toThrow("records_lock_requires_school_leadership");
    const changed = [computeSubjectGrade({ scope, policy, entries: [entry({ category: "EXAM", pointsEarned: 95, pointsPossible: 100 }), entry({ category: "CLASSWORK" })] })];
    expect(() => lockPeriod(verified.period, { actor: principal, currentResults: changed, at: "2027-01-22T00:00:00.000Z" })).toThrow("records_results_changed_since_verification");
    const locked = lockPeriod(verified.period, { actor: principal, currentResults: results, at: "2027-01-22T00:00:00.000Z" });
    expect(locked.period.state).toBe("LOCKED");
    expect(() => verifyPeriod(locked.period, { actor: teacher, results, at: "2027-01-23T00:00:00.000Z" })).toThrow("records_period_locked");
  });
});

describe("Official report cards", () => {
  it("refuses wrong-school, wrong-year, wrong-period and mixed-policy drafts", () => {
    const base = { recordId: "x", kind: "PERIOD" as const, calendar, periodId: "p1", student: { studentId: "stu-1", schoolId: SCHOOL }, enrollment: { enrollmentId: "enr-1", studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, classIds: ["class-math"] }, gradingPolicy: policyRef(policy), results: [completeResult()], teacherComments: {}, attendance: tallyAttendance([]), masteryIndicators: [], strengths: [], areasForImprovement: [], interventionPlan: [], yearEndDecision: { status: "NOT_APPLICABLE" as const, outcome: null, decidedBy: null } };
    expect(() => buildReportCardDraft({ ...base, student: { studentId: "stu-1", schoolId: "school-2" } })).toThrow("records_report_school_mismatch");
    expect(() => buildReportCardDraft({ ...base, enrollment: { ...base.enrollment, academicYearId: "year-2025" } })).toThrow("records_report_enrollment_mismatch");
    expect(() => buildReportCardDraft({ ...base, periodId: "p-of-other-calendar" })).toThrow("records_report_period_not_in_calendar");
    expect(() => buildReportCardDraft({ ...base, enrollment: { ...base.enrollment, classIds: ["class-other"] } })).toThrow("records_report_class_not_enrolled");
    expect(() => buildReportCardDraft({ ...base, gradingPolicy: policyRef({ ...policy, version: "other" }) })).toThrow("records_report_mixed_grading_policies");
  });

  it("publishes only locked, complete periods by school leadership with optimistic concurrency", () => {
    const record = draft();
    const results = [completeResult()];
    const periods = [lockedPeriod(results)];
    expect(() => publishReportCard(record, { actor: teacher, expectedVersion: 1, currentStoredVersion: 1, periods, principalComment: null, at: "2027-01-25T00:00:00.000Z" })).toThrow("records_requires_school_leadership");
    expect(() => publishReportCard(record, { actor: { ...principal, schoolId: "school-2" }, expectedVersion: 1, currentStoredVersion: 1, periods, principalComment: null, at: "2027-01-25T00:00:00.000Z" })).toThrow("records_requires_school_leadership");
    expect(() => publishReportCard(record, { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods: [], principalComment: null, at: "2027-01-25T00:00:00.000Z" })).toThrow(/records_report_period_not_locked/);
    const { record: published } = publishReportCard(record, { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods, principalComment: "Good term.", at: "2027-01-25T00:00:00.000Z" });
    expect(published.status).toBe("PUBLISHED");
    // A second concurrent publish of the same draft is refused: the stored version has moved on.
    expect(() => publishReportCard(record, { actor: admin, expectedVersion: 1, currentStoredVersion: 2, periods, principalComment: null, at: "2027-01-25T00:00:01.000Z" })).toThrow("records_report_version_conflict");
    expect(() => publishReportCard(published, { actor: admin, expectedVersion: 1, currentStoredVersion: 1, periods, principalComment: null, at: "2027-01-25T00:00:01.000Z" })).toThrow("records_report_not_draft");
    const incomplete = draft([computeSubjectGrade({ scope, policy, entries: [entry({}), entry({ status: "MISSING", pointsEarned: null })] })]);
    expect(() => publishReportCard(incomplete, { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods, principalComment: null, at: "2027-01-25T00:00:00.000Z" })).toThrow(/records_report_subject_incomplete/);
  });

  it("changes published records only through an independently approved amendment that preserves history", () => {
    const results = [completeResult()];
    const { record: published } = publishReportCard(draft(results), { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods: [lockedPeriod(results)], principalComment: null, at: "2027-01-25T00:00:00.000Z" });
    const change = { attendance: tallyAttendance([{ status: "PRESENT" }, { status: "PRESENT" }]) };
    expect(() => amendPublishedReportCard(published, { reason: "Attendance register corrected", requestedBy: principal.userId, approver: principal, changes: change, at: "2027-02-01T00:00:00.000Z" })).toThrow("records_amendment_requires_independent_approver");
    expect(() => amendPublishedReportCard(published, { reason: "fix", requestedBy: teacher.userId, approver: principal, changes: change, at: "2027-02-01T00:00:00.000Z" })).toThrow("records_amendment_reason_required");
    expect(() => amendPublishedReportCard(published, { reason: "Attendance register corrected", requestedBy: teacher.userId, approver: teacher, changes: change, at: "2027-02-01T00:00:00.000Z" })).toThrow("records_requires_school_leadership");
    const { superseded, amended, audit } = amendPublishedReportCard(published, { reason: "Attendance register corrected by the class teacher", requestedBy: teacher.userId, approver: principal, changes: change, at: "2027-02-01T00:00:00.000Z" });
    expect(superseded).toMatchObject({ status: "SUPERSEDED", version: 1, contentHash: published.contentHash, attendance: published.attendance });
    expect(amended).toMatchObject({ status: "PUBLISHED", version: 2, priorVersionHash: published.contentHash });
    expect(amended.contentHash).not.toBe(published.contentHash);
    expect(audit.action).toBe("records.report_card.amended");
  });

  it("restricts viewing: families see published only; teachers see their classes; no cross-school access", () => {
    const record = draft();
    const results = [completeResult()];
    const { record: published } = publishReportCard(record, { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods: [lockedPeriod(results)], principalComment: null, at: "2027-01-25T00:00:00.000Z" });
    const student = { userId: "u-stu-1", role: "STUDENT" as const, schoolId: SCHOOL, classIds: [], studentId: "stu-1" };
    expect(canViewReportCard(student, record)).toBe(false);
    expect(canViewReportCard(student, published)).toBe(true);
    expect(canViewReportCard({ ...student, studentId: "stu-2" }, published)).toBe(false);
    expect(canViewReportCard({ userId: "g", role: "GUARDIAN", schoolId: null, classIds: [], linkedStudentIds: ["stu-1"] }, published)).toBe(true);
    expect(canViewReportCard({ userId: "g", role: "GUARDIAN", schoolId: null, classIds: [], linkedStudentIds: ["stu-9"] }, published)).toBe(false);
    expect(canViewReportCard(teacher, record)).toBe(true);
    expect(canViewReportCard({ ...teacher, classIds: ["class-other"] }, record)).toBe(false);
    expect(canViewReportCard({ ...admin, schoolId: "school-2" }, published)).toBe(false);
  });

  it("keeps attendance honest: excused separate, no records is not 0%", () => {
    expect(tallyAttendance([])).toMatchObject({ status: "NO_RECORDS", ratePercent: null });
    expect(tallyAttendance([{ status: "PRESENT" }, { status: "LATE" }, { status: "EXCUSED" }, { status: "ABSENT" }])).toMatchObject({ present: 1, late: 1, excused: 1, absent: 1, ratePercent: 50 });
  });

  it("renders an accessible report with mastery separately labelled from grades", () => {
    const results = [completeResult()];
    const { record: published } = publishReportCard(draft(results), { actor: principal, expectedVersion: 1, currentStoredVersion: 1, periods: [lockedPeriod(results)], principalComment: "Keep going.", at: "2027-01-25T00:00:00.000Z" });
    const view = buildReportCardView(published, { audience: "GUARDIAN", studentName: "Fatu K.", schoolName: "Model School", periodName: "First Semester", yearLabel: "2026/2027", gradeLevel: 7 });
    const html = renderToStaticMarkup(createElement(OfficialReportCard, { view }));
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Skill mastery (separate from grades)");
    expect(html).toContain("It does not change the grades above.");
    expect(html).toContain("Developing");
    expect(html).toContain("83.1% (B)"); // (30×80 + 50×85) / 80 after renormalizing the empty QUIZ weight
    expect(html).toContain("excused 1");
    expect(html).not.toContain("DRAFT");
    expect(() => buildReportCardView(draft(), { audience: "STUDENT", studentName: "x", schoolName: "y", periodName: "z", yearLabel: "w", gradeLevel: 7 })).toThrow("records_view_unpublished_for_family");
    const teacherView = buildReportCardView(draft(), { audience: "TEACHER", studentName: "x", schoolName: "y", periodName: "z", yearLabel: "w", gradeLevel: 7 });
    expect(teacherView.watermark).toBe("DRAFT — NOT AN OFFICIAL RECORD");
    const noEvidence = buildReportCardView(draft([computeSubjectGrade({ scope, policy, entries: [] })]), { audience: "ADMIN", studentName: "x", schoolName: "y", periodName: "z", yearLabel: "w", gradeLevel: 7 });
    expect(noEvidence.subjects[0]).toMatchObject({ grade: "Not graded", result: "No graded work this period" });
  });
});
