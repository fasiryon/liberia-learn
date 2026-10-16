import type { AcademicCalendar, GradeEntry, GradingPolicy, PromotionPolicy, RecordsActor, YearEndRecord } from "@/lib/academic-records/v2";

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
};

export const policy: GradingPolicy = {
  policyId: "school-1-grading", version: "2026.1", schoolId: SCHOOL, status: "APPROVED",
  approvedBy: { userId: "principal-1", role: "PRINCIPAL" },
  source: { kind: "SCHOOL_POLICY", reference: "Board minute 2026-08-14", attestedBy: null },
  categories: [{ category: "CLASSWORK", weightPercent: 30 }, { category: "QUIZ", weightPercent: 20 }, { category: "EXAM", weightPercent: 50 }],
  withinCategory: "POINTS", emptyCategory: "RENORMALIZE", missingWork: "EXCLUDE_UNTIL_RESOLVED",
  late: { penaltyPercentPerDay: 10, maxPenaltyPercent: 50 },
  scale: [{ minPercent: 90, label: "A", passing: true }, { minPercent: 80, label: "B", passing: true }, { minPercent: 70, label: "C", passing: true }, { minPercent: 0, label: "F", passing: false }],
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

export const promotionPolicy: PromotionPolicy = {
  policyId: "school-1-promotion", version: "2026.1", schoolId: SCHOOL, status: "APPROVED",
  source: { kind: "SCHOOL_POLICY", reference: "Board minute 2026-08-14", attestedBy: null },
  appliesToGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], terminalGrade: 12,
  requiredSubjects: ["MATH", "ENGLISH", "SCIENCE"], maxFailedForPromotion: 0, maxFailedForConditional: 1,
  minAttendancePercent: 75, graduationRequirements: [{ requirementId: "national-exam", description: "Applicable national examination result recorded" }],
};

export function yearEnd(overrides: Partial<YearEndRecord> = {}): YearEndRecord {
  return {
    studentId: "stu-1", schoolId: SCHOOL, academicYearId: YEAR, grade: 7, enrollmentStatus: "ACTIVE", recordsFinalized: true,
    subjects: [
      { subject: "MATH", status: "COMPLETE", percent: 82, passing: true },
      { subject: "ENGLISH", status: "COMPLETE", percent: 77, passing: true },
      { subject: "SCIENCE", status: "COMPLETE", percent: 74, passing: true },
    ],
    attendancePercent: 92, graduationRequirementsMet: {},
    ...overrides,
  };
}
