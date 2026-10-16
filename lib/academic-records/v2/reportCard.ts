/**
 * Official report-card record (period or year-end). Academic grades and skill mastery are separate,
 * separately labelled fields: mastery never feeds a grade and a grade never implies mastery.
 *
 * Lifecycle: DRAFT → PUBLISHED → (SUPERSEDED by an approved AMENDMENT). Publication is either
 * OFFICIAL (every subject COMPLETE and every period LOCKED) or explicitly PROVISIONAL (labelled,
 * never final, never usable for promotion). Incomplete records cannot be published as official.
 * A published record is
 * immutable; corrections create a new version linked to the prior hash, with a reason, a requester
 * and a different approving leader. Publication uses optimistic concurrency (expected version), so
 * two concurrent publishes cannot both succeed.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { findPeriod, type AcademicCalendar } from "./calendar";
import type { LlMasteryState } from "@/lib/academic-policy/llAep001";
import type { GroupResult, SubjectGradeResult } from "./gradeCalculation";
import type { GradingPolicyRef } from "./gradingPolicy";
import type { ClassSubjectPeriod, RecordsActor, RecordsAuditEvent } from "./periodLock";
import type { PromotionRecommendationKind } from "./promotion";

export type AttendanceTally = Readonly<{
  status: "RECORDED" | "NO_RECORDS";
  sessions: number;
  present: number;
  absent: number;
  excused: number;
  late: number;
  /** Null when no sessions were recorded. Never 0% for "no data". */
  ratePercent: number | null;
}>;

export type MasteryIndicator = Readonly<{
  subject: string;
  objectiveId: string;
  /** Fixed label so every renderer shows mastery as distinct from the academic grade. */
  label: "SKILL_MASTERY_INDICATOR_NOT_A_GRADE";
  level: LlMasteryState;
  /** Mastery shown on records must come from admitted learning evidence only. */
  evidenceTier: "MASTERY_ADMITTED_EVIDENCE";
  asOf: string;
}>;

export type ReportSubjectLine = Readonly<{
  subject: string;
  classId: string;
  status: SubjectGradeResult["status"];
  percent: number | null;
  label: string | null;
  passing: boolean | null;
  meetsProficiencyTarget: boolean | null;
  groups: readonly GroupResult[];
  teacherComment: string | null;
}>;

export type YearEndDecisionLine = Readonly<{
  status: "NOT_APPLICABLE" | "PENDING_REVIEW" | "RECOMMENDED" | "DECIDED" | "UNDER_APPEAL";
  outcome: PromotionRecommendationKind | null;
  decidedBy: string | null;
}>;

export type ReportCardRecord = Readonly<{
  recordId: string;
  version: number;
  kind: "PERIOD" | "YEAR_END";
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  /** Null until published. PROVISIONAL records are labelled and never final. */
  publication: "OFFICIAL" | "PROVISIONAL" | null;
  schoolId: string;
  academicYearId: string;
  periodId: string;
  studentId: string;
  enrollmentId: string;
  gradingPolicy: GradingPolicyRef;
  subjects: readonly ReportSubjectLine[];
  attendance: AttendanceTally;
  masteryIndicators: readonly MasteryIndicator[];
  strengths: readonly string[];
  areasForImprovement: readonly string[];
  interventionPlan: readonly string[];
  yearEndDecision: YearEndDecisionLine;
  principalComment: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  priorVersionHash: string | null;
  amendment: Readonly<{ reason: string; requestedBy: string; approvedBy: string; at: string }> | null;
  contentHash: string;
}>;

type Unsealed = Omit<ReportCardRecord, "contentHash">;

export function hashReportCard(record: Unsealed | ReportCardRecord): string {
  // Lifecycle status is excluded so publishing or superseding never changes what the record says.
  const { contentHash: _hash, status: _status, ...content } = record as ReportCardRecord;
  return createHash("sha256").update(canonicalizeJson({ domain: "liberialearn.report-card.v2", content })).digest("hex");
}

const seal = (record: Unsealed): ReportCardRecord => Object.freeze({ ...record, contentHash: hashReportCard(record) });

export function tallyAttendance(rows: readonly Readonly<{ status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" }>[]): AttendanceTally {
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const present = count("PRESENT");
  const late = count("LATE");
  const sessions = rows.length;
  return Object.freeze({
    status: sessions === 0 ? "NO_RECORDS" : "RECORDED",
    sessions,
    present,
    absent: count("ABSENT"),
    excused: count("EXCUSED"),
    late,
    // Late arrivals attended; excused absences are reported separately, not as attendance.
    ratePercent: sessions === 0 ? null : Math.round(((present + late) / sessions) * 1000) / 10,
  });
}

export type ReportCardDraftInput = Readonly<{
  recordId: string;
  kind: ReportCardRecord["kind"];
  calendar: AcademicCalendar;
  periodId: string;
  student: Readonly<{ studentId: string; schoolId: string }>;
  enrollment: Readonly<{ enrollmentId: string; studentId: string; schoolId: string; academicYearId: string; classIds: readonly string[] }>;
  gradingPolicy: GradingPolicyRef;
  results: readonly SubjectGradeResult[];
  teacherComments: Readonly<Record<string, string>>;
  attendance: AttendanceTally;
  masteryIndicators: readonly MasteryIndicator[];
  strengths: readonly string[];
  areasForImprovement: readonly string[];
  interventionPlan: readonly string[];
  yearEndDecision: YearEndDecisionLine;
}>;

/** Builds a draft only after proving the period, class, enrollment and policy all belong to one school and year. */
export function buildReportCardDraft(input: ReportCardDraftInput): ReportCardRecord {
  const { calendar, student, enrollment } = input;
  if (student.schoolId !== calendar.schoolId || enrollment.schoolId !== calendar.schoolId) throw new Error("records_report_school_mismatch");
  if (enrollment.studentId !== student.studentId || enrollment.academicYearId !== calendar.academicYearId) throw new Error("records_report_enrollment_mismatch");
  const period = findPeriod(calendar, input.periodId);
  if (!period) throw new Error("records_report_period_not_in_calendar");
  if (!period.issuesReport) throw new Error("records_report_period_does_not_issue_reports");
  for (const result of input.results) {
    if (result.scope.studentId !== student.studentId || result.scope.schoolId !== calendar.schoolId || result.scope.periodId !== input.periodId) throw new Error("records_report_result_scope_mismatch");
    if (!enrollment.classIds.includes(result.scope.classId)) throw new Error("records_report_class_not_enrolled");
    if (result.policy.hash !== input.gradingPolicy.hash) throw new Error("records_report_mixed_grading_policies");
  }
  if (new Set(input.results.map((result) => result.scope.subject)).size !== input.results.length) throw new Error("records_report_duplicate_subject");
  for (const indicator of input.masteryIndicators) {
    if (indicator.label !== "SKILL_MASTERY_INDICATOR_NOT_A_GRADE" || indicator.evidenceTier !== "MASTERY_ADMITTED_EVIDENCE") throw new Error("records_report_mastery_indicator_invalid");
  }
  return seal({
    recordId: input.recordId,
    version: 1,
    kind: input.kind,
    status: "DRAFT",
    publication: null,
    schoolId: calendar.schoolId,
    academicYearId: calendar.academicYearId,
    periodId: input.periodId,
    studentId: student.studentId,
    enrollmentId: enrollment.enrollmentId,
    gradingPolicy: input.gradingPolicy,
    subjects: Object.freeze(input.results.map((result) => Object.freeze({
      subject: result.scope.subject, classId: result.scope.classId, status: result.status, percent: result.percent,
      label: result.label, passing: result.passing, meetsProficiencyTarget: result.meetsProficiencyTarget, groups: result.groups,
      teacherComment: input.teacherComments[result.scope.subject] ?? null,
    }))),
    attendance: input.attendance,
    masteryIndicators: Object.freeze([...input.masteryIndicators]),
    strengths: Object.freeze([...input.strengths]),
    areasForImprovement: Object.freeze([...input.areasForImprovement]),
    interventionPlan: Object.freeze([...input.interventionPlan]),
    yearEndDecision: input.yearEndDecision,
    principalComment: null,
    publishedBy: null,
    publishedAt: null,
    priorVersionHash: null,
    amendment: null,
  });
}

function assertLeader(actor: RecordsActor, schoolId: string) {
  if ((actor.role !== "PRINCIPAL" && actor.role !== "ADMIN") || actor.schoolId !== schoolId) throw new Error("records_requires_school_leadership");
}

export function publishReportCard(record: ReportCardRecord, input: {
  actor: RecordsActor;
  publication: "OFFICIAL" | "PROVISIONAL";
  expectedVersion: number;
  currentStoredVersion: number;
  periods: readonly ClassSubjectPeriod[];
  principalComment: string | null;
  at: string;
}): Readonly<{ record: ReportCardRecord; audit: RecordsAuditEvent }> {
  assertLeader(input.actor, record.schoolId);
  if (record.status !== "DRAFT") throw new Error("records_report_not_draft");
  if (input.expectedVersion !== record.version || input.currentStoredVersion !== record.version) throw new Error("records_report_version_conflict");
  if (record.contentHash !== hashReportCard(record)) throw new Error("records_report_tampered");
  if (input.publication === "OFFICIAL") {
    for (const subject of record.subjects) {
      // An official record must be complete: incomplete or ungraded subjects need a provisional record.
      if (subject.status !== "COMPLETE") throw new Error(`records_report_subject_not_complete:${subject.subject}:${subject.status}`);
      const period = input.periods.find((candidate) => candidate.classId === subject.classId && candidate.subject === subject.subject && candidate.periodId === record.periodId && candidate.schoolId === record.schoolId);
      if (!period || period.state !== "LOCKED") throw new Error(`records_report_period_not_locked:${subject.subject}`);
    }
    if (record.kind === "YEAR_END" && record.yearEndDecision.status === "RECOMMENDED") throw new Error("records_year_end_decision_not_authorized");
  } else if (record.kind === "YEAR_END" && record.yearEndDecision.status === "DECIDED") {
    throw new Error("records_year_end_decision_requires_official_record");
  }
  const published = seal({ ...record, publication: input.publication, principalComment: input.principalComment, publishedBy: input.actor.userId, publishedAt: input.at, status: "PUBLISHED" } as Unsealed);
  return Object.freeze({
    record: published,
    audit: { action: "records.report_card.published", resourceRef: `${record.recordId}@${record.version}`, actorId: input.actor.userId, schoolId: record.schoolId, at: input.at, details: { contentHash: published.contentHash, publication: input.publication } },
  });
}

export type ReportCardAmendment = Readonly<{
  reason: string;
  requestedBy: string;
  approver: RecordsActor;
  changes: Partial<Pick<ReportCardRecord, "subjects" | "attendance" | "principalComment" | "strengths" | "areasForImprovement" | "interventionPlan" | "yearEndDecision" | "masteryIndicators">>;
  at: string;
}>;

/** Produces the superseded prior record and the new published version; nothing is edited in place. */
export function amendPublishedReportCard(published: ReportCardRecord, amendment: ReportCardAmendment): Readonly<{
  superseded: ReportCardRecord;
  amended: ReportCardRecord;
  audit: RecordsAuditEvent;
}> {
  if (published.status !== "PUBLISHED") throw new Error("records_amendment_requires_published_record");
  assertLeader(amendment.approver, published.schoolId);
  if (amendment.approver.userId === amendment.requestedBy) throw new Error("records_amendment_requires_independent_approver");
  if (amendment.reason.trim().length < 15) throw new Error("records_amendment_reason_required");
  if (Object.keys(amendment.changes).length === 0) throw new Error("records_amendment_changes_required");
  const superseded = Object.freeze({ ...published, status: "SUPERSEDED" as const });
  const amended = seal({
    ...published,
    ...amendment.changes,
    version: published.version + 1,
    status: "PUBLISHED",
    publishedBy: amendment.approver.userId,
    publishedAt: amendment.at,
    priorVersionHash: published.contentHash,
    amendment: { reason: amendment.reason, requestedBy: amendment.requestedBy, approvedBy: amendment.approver.userId, at: amendment.at },
  } as Unsealed);
  return Object.freeze({
    superseded,
    amended,
    audit: { action: "records.report_card.amended", resourceRef: `${published.recordId}@${amended.version}`, actorId: amendment.approver.userId, schoolId: published.schoolId, at: amendment.at, details: { priorVersionHash: published.contentHash, fields: Object.keys(amendment.changes).sort().join(",") } },
  });
}

/** Only an official, published, current record is final (eligible input to promotion). */
export function isFinalOfficialRecord(record: ReportCardRecord): boolean {
  return record.status === "PUBLISHED" && record.publication === "OFFICIAL" && record.contentHash === hashReportCard(record);
}

/** Viewing rules. Students and guardians see published records only; teachers see their classes. */
export function canViewReportCard(viewer: RecordsActor & { linkedStudentIds?: readonly string[]; studentId?: string | null }, record: ReportCardRecord): boolean {
  if (record.status === "SUPERSEDED" && viewer.role !== "ADMIN" && viewer.role !== "PRINCIPAL") return false;
  switch (viewer.role) {
    case "STUDENT":
      return record.status === "PUBLISHED" && viewer.studentId === record.studentId;
    case "GUARDIAN":
      return record.status === "PUBLISHED" && (viewer.linkedStudentIds ?? []).includes(record.studentId);
    case "TEACHER":
      return viewer.schoolId === record.schoolId && record.subjects.some((subject) => viewer.classIds.includes(subject.classId));
    case "ADMIN":
    case "PRINCIPAL":
      return viewer.schoolId === record.schoolId;
    default:
      return false;
  }
}
