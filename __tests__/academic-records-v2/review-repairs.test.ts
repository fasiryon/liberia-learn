/**
 * Regression tests for the PR #194 final merge-readiness review (2026-10-16).
 *
 *   R1  the legacy report-card generator must not average unverified AI scores (including scores
 *       auto-released before the LL-AEP-001 fix) or submissions from another school
 *   R2  a teacher's own grade is teacher-verified: the grade routes mark it, the stale-AI job never
 *       touches it, and the V2 classifier does not mistake it for an auto-released AI score
 *   R3  an appeal revision obeys the same invariants as an original decision (retention needs
 *       documented intervention; no promotion past, or graduation before, the terminal grade)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  term: { findUniqueOrThrow: vi.fn() },
  reportCard: { findUnique: vi.fn(), upsert: vi.fn() },
  student: { findUniqueOrThrow: vi.fn() },
  assignmentSubmission: { findMany: vi.fn(), updateMany: vi.fn() },
  class: { findFirst: vi.fn() },
  grade: { findMany: vi.fn() },
  attendance: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: vi.fn().mockResolvedValue(undefined) }));

import { generateReportCard } from "@/lib/reportCards/generateReportCard";
import { releaseStaleAIGrades } from "@/lib/ai/staleGradeReleaser";
import { legacyAssignmentScoreAuthority } from "@/lib/academic-records/v2/gradeCalculation";
import { decidePromotion, openAppeal, resolveAppeal } from "@/lib/academic-records/v2/promotionDecision";
import { evaluatePromotionEligibility } from "@/lib/academic-records/v2/promotion";
import { admin, ALL_PROGRAM_MET, calendar, principal, promotionPolicy, yearEnd } from "./fixtures";

const SCHOOL = "school-1";
const T0 = new Date("2026-02-01T00:00:00.000Z");
const LATER = new Date("2026-02-05T00:00:00.000Z");

function submission(overrides: Record<string, unknown>) {
  return {
    score: 90, gradedAt: T0, turnedInAt: T0, teacherApproved: false, autoReleasedAt: null, aiGrade: null, gradedBy: "teacher-1",
    Assignment: { Class: { subject: "MATH", schoolId: SCHOOL } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.term.findUniqueOrThrow.mockResolvedValue({ id: "term-1", startDate: new Date("2026-01-01"), endDate: new Date("2026-04-30"), academicYear: { schoolId: SCHOOL } });
  db.reportCard.findUnique.mockResolvedValue(null);
  db.reportCard.upsert.mockImplementation(({ create }: { create: Record<string, unknown> }) => Promise.resolve({ id: "rc-1", ...create }));
  db.student.findUniqueOrThrow.mockResolvedValue({ id: "stu-1", user: { schoolId: SCHOOL } });
  db.class.findFirst.mockResolvedValue({ subject: "MATH" });
  db.grade.findMany.mockResolvedValue([]);
  db.attendance.findMany.mockResolvedValue([]);
});

describe("R1 legacy report card counts only teacher-verified scores from the student's school", () => {
  it("scopes the submission query to the card's school", async () => {
    db.assignmentSubmission.findMany.mockResolvedValue([]);
    await generateReportCard("stu-1", "term-1", "class-1", "admin-1");
    expect(db.assignmentSubmission.findMany.mock.calls[0][0].where).toMatchObject({ Assignment: { Class: { schoolId: SCHOOL } } });
  });

  it("excludes AI scores auto-released before the fix and AI scores no teacher touched", async () => {
    db.assignmentSubmission.findMany.mockResolvedValue([
      submission({ score: 60 }),
      // Legacy auto-release: the AI grade was copied into `score` at release time.
      submission({ score: 100, aiGrade: 100, autoReleasedAt: T0, gradedAt: T0, gradedBy: null }),
      // Legacy auto-release that overwrote an earlier, unapproved teacher grade.
      submission({ score: 100, aiGrade: 100, autoReleasedAt: T0, gradedAt: T0, gradedBy: "teacher-1" }),
      // AI score with no teacher authority at all.
      submission({ score: 100, aiGrade: 100, gradedBy: null }),
    ]);
    await generateReportCard("stu-1", "term-1", "class-1", "admin-1");
    const grades = db.reportCard.upsert.mock.calls[0][0].create.subjectGrades;
    expect(grades).toEqual([expect.objectContaining({ subject: "MATH", average: 60, assignmentCount: 1 })]);
  });

  it("keeps a score a teacher approved, or regraded after the auto-release", async () => {
    db.assignmentSubmission.findMany.mockResolvedValue([
      submission({ score: 70, aiGrade: 100, autoReleasedAt: T0, teacherApproved: true }),
      submission({ score: 80, aiGrade: 100, autoReleasedAt: T0, gradedAt: LATER, gradedBy: "teacher-1" }),
    ]);
    await generateReportCard("stu-1", "term-1", "class-1", "admin-1");
    const grades = db.reportCard.upsert.mock.calls[0][0].create.subjectGrades;
    expect(grades).toEqual([expect.objectContaining({ average: 75, assignmentCount: 2 })]);
  });
});

describe("R2 a teacher's own grade is teacher-verified", () => {
  it("the classifier treats a regrade after auto-release as TEACHER and a pre-release grade as AI", () => {
    expect(legacyAssignmentScoreAuthority({ score: 80, teacherApproved: false, autoReleasedAt: T0, aiGrade: 100, gradedBy: "teacher-1", gradedAt: LATER })).toBe("TEACHER");
    expect(legacyAssignmentScoreAuthority({ score: 100, teacherApproved: false, autoReleasedAt: T0, aiGrade: 100, gradedBy: "teacher-1", gradedAt: T0 })).toBe("AI_AUTO_RELEASED");
    expect(legacyAssignmentScoreAuthority({ score: 100, teacherApproved: false, autoReleasedAt: T0, aiGrade: 100, gradedBy: null, gradedAt: T0 })).toBe("AI_AUTO_RELEASED");
  });

  it("the stale-AI job never selects or claims a submission a teacher already graded", async () => {
    db.assignmentSubmission.findMany.mockResolvedValue([
      { id: "sub-1", assignmentId: "a-1", Assignment: { id: "a-1", title: "T", Class: { schoolId: SCHOOL } }, Student: { id: "stu-1", user: { id: "u-1" } } },
    ]);
    db.assignmentSubmission.updateMany.mockResolvedValue({ count: 1 });
    await releaseStaleAIGrades();
    expect(db.assignmentSubmission.findMany.mock.calls[0][0].where).toMatchObject({ gradedBy: null, score: null });
    expect(db.assignmentSubmission.updateMany.mock.calls[0][0].where).toMatchObject({ gradedBy: null, score: null });
  });
});

describe("R3 appeal revisions obey decision invariants", () => {
  const rationale = "Panel reviewed the full record and the appeal evidence.";
  const at = "2027-08-03T00:00:00.000Z";
  const filedBy = { userId: "teacher-9", role: "TEACHER" as const };

  it("cannot revise a promotion into retention without documented, reviewed intervention", () => {
    const recommendation = evaluatePromotionEligibility(yearEnd(), promotionPolicy);
    const { decision } = decidePromotion({ decisionId: "dec-p", recommendation, outcome: "PROMOTE", actor: principal, rationale: null, supportPlan: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" });
    const appeal = openAppeal(decision, { appealId: "ap-r", filedBy, reason: "Student needs another year in this grade.", filedAt: "2027-07-20T00:00:00.000Z", calendar });
    expect(() => resolveAppeal(appeal, decision, { panel: [principal, admin], outcome: "REVISED", revisedOutcome: "RETAIN", rationale, supportPlan: null, at }))
      .toThrow("records_retention_requires_documented_intervention");
  });

  it("cannot revise a graduation into promotion past the terminal grade", () => {
    const recommendation = evaluatePromotionEligibility(yearEnd({ grade: 12, programRequirementsMet: ALL_PROGRAM_MET }), promotionPolicy);
    const { decision } = decidePromotion({ decisionId: "dec-g", recommendation, outcome: "GRADUATE", actor: principal, rationale: null, supportPlan: null, terminalGrade: 12, at: "2027-07-08T00:00:00.000Z" });
    const appeal = openAppeal(decision, { appealId: "ap-g", filedBy, reason: "The graduation decision should be reconsidered.", filedAt: "2027-07-20T00:00:00.000Z", calendar });
    expect(() => resolveAppeal(appeal, decision, { panel: [principal, admin], outcome: "REVISED", revisedOutcome: "PROMOTE", rationale, supportPlan: null, at }))
      .toThrow("records_cannot_promote_past_terminal_grade");
  });
});
