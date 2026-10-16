import { llPromotionPolicyFor, type AcademicCalendar, type GradeEntry, type GradingPolicy, type PromotionPolicy, type RecordsActor, type YearEndRecord } from "@/lib/academic-records/v2";

export const SCHOOL = "school-1";
export const YEAR = "year-2026";

export const calendar: AcademicCalendar = {
  schoolId: SCHOOL, academicYearId: YEAR, yearLabel: "2026/2027",
  startDate: "2026-09-01T00:00:00.000Z", endDate: "2027-07-15T00:00:00.000Z",
  // Deliberately three semesters-and-a-half style periods: not four quarters.
  periods: [
    { periodId: "p1", name: "First Semester", order: 1, startDate: "2026-09-01T00:00:00.000Z", endDate: "2027-01-20T00:00:00.000Z", issuesReport: true },
    { periodId: "p2", name: "Second Semester", order: 2, startDate: "2027-02-01T00:00:00.000Z", endDate: "2027-06-30T00:00:00.000Z", issuesReport: true },
  ],
  closeout: { finalReportOn: "2027-07-05T00:00:00.000Z", promotionDecisionsBy: "2027-07-10T00:00:00.000Z" },
  nonInstructionalDates: ["2027-07-26"],
  weekendDays: [0, 6],
};

/** A school's own (non-baseline) policy: proves the engine has no hard-coded formula. */
export const policy: GradingPolicy = {
  policyId: "school-1-grading", version: "2026.1", scope: { kind: "SCHOOL", schoolId: SCHOOL }, status: "APPROVED",
  approvedBy: { userId: "principal-1", role: "PRINCIPAL" },
  source: { kind: "SCHOOL_POLICY", reference: "Board minute 2026-08-14", attestedBy: null }, derivedFrom: null,
  appliesToGrades: [7],
  groups: [
    { groupId: "CLASSWORK", label: "Classwork", weightPercent: 30, includes: ["CLASSWORK"] },
    { groupId: "QUIZ", label: "Quizzes", weightPercent: 20, includes: ["QUIZ"] },
    { groupId: "EXAM", label: "Examinations", weightPercent: 50, includes: ["EXAM"] },
  ],
  prohibitedCategories: [],
  withinGroup: "POINTS", emptyGroup: "RENORMALIZE", missingWork: "EXCLUDE_UNTIL_RESOLVED",
  late: { penaltyPercentPerDay: 10, maxPenaltyPercent: 50 }, reassessment: "LATEST", maxSingleAssessmentSharePercent: 100,
  scale: [{ minPercent: 90, label: "A", meaning: "" }, { minPercent: 80, label: "B", meaning: "" }, { minPercent: 70, label: "C", meaning: "" }, { minPercent: 0, label: "F", meaning: "" }],
  thresholds: { passingPercent: 70, proficiencyTargetPercent: 80 },
  roundingDecimals: 1, minimumScoredEntries: 2,
};

export const scope = { studentId: "stu-1", schoolId: SCHOOL, classId: "class-math", subject: "MATH", periodId: "p1" };

let counter = 0;
export function entry(overrides: Partial<GradeEntry>): GradeEntry {
  counter += 1;
  return {
    entryId: `e${counter}`, sourceRef: `src-${counter}`, ...scope, category: "CLASSWORK", status: "SCORED",
    pointsEarned: 8, pointsPossible: 10, daysLate: 0, teacherConfirmedMissing: false, scoreAuthority: "TEACHER",
    ...overrides,
  };
}

export const teacher: RecordsActor = { userId: "teacher-1", role: "TEACHER", schoolId: SCHOOL, classIds: ["class-math"] };
export const principal: RecordsActor = { userId: "principal-1", role: "PRINCIPAL", schoolId: SCHOOL, classIds: [] };
export const admin: RecordsActor = { userId: "admin-1", role: "ADMIN", schoolId: SCHOOL, classIds: [] };

export const promotionPolicy: PromotionPolicy = llPromotionPolicyFor({
  schoolId: SCHOOL, version: "2026.1", status: "APPROVED",
  appliesToGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  requiredSubjects: ["MATH", "ENGLISH", "SCIENCE"],
  criticalCompetencies: [{ subject: "MATH", objectiveId: "math-place-value" }, { subject: "ENGLISH", objectiveId: "eng-reading-comprehension" }],
  programRequirements: [
    { requirementId: "CREDITS_COMPLETED", description: "Required credits completed" },
    { requirementId: "APPROVED_ASSESSMENTS_PASSED", description: "Approved assessments passed" },
    { requirementId: "MAJOR_PROJECT_COMPLETED", description: "Major project completed" },
  ],
});

export const ALL_PROGRAM_MET = { CREDITS_COMPLETED: true, APPROVED_ASSESSMENTS_PASSED: true, MAJOR_PROJECT_COMPLETED: true };

export function yearEnd(overrides: Partial<YearEndRecord> = {}): YearEndRecord {
  return {
    studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, grade: 7, enrollmentStatus: "ACTIVE", recordsFinalized: true,
    subjects: [
      { subject: "MATH", status: "COMPLETE", percent: 82, passing: true },
      { subject: "ENGLISH", status: "COMPLETE", percent: 77, passing: true },
      { subject: "SCIENCE", status: "COMPLETE", percent: 74, passing: true },
    ],
    competencies: [{ objectiveId: "math-place-value", state: "SECURE" }, { objectiveId: "eng-reading-comprehension", state: "ADVANCED" }],
    attendancePercent: 92, attendanceException: null, interventions: [],
    programRequirementsMet: {}, nationalSchoolLeaving: { applicable: false, met: null, reference: null },
    ...overrides,
  };
}
