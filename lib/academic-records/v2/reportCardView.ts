/**
 * Audience-aware view model for the official report card. Every audience sees the same official
 * content; what differs is whether drafts and internal blockers are visible. Wording is plain and
 * never colour-dependent: each status has text.
 */
import type { ReportCardRecord } from "./reportCard";

export type ReportAudience = "STUDENT" | "GUARDIAN" | "TEACHER" | "ADMIN";

export type ReportCardView = Readonly<{
  heading: string;
  subheading: string;
  watermark: "DRAFT — NOT AN OFFICIAL RECORD" | "PROVISIONAL — NOT A FINAL ACADEMIC RECORD" | "SUPERSEDED — SEE LATEST VERSION" | null;
  subjects: readonly Readonly<{ subject: string; grade: string; result: string; breakdown: string; comment: string | null }>[];
  attendance: string;
  mastery: Readonly<{ title: string; note: string; rows: readonly Readonly<{ subject: string; objective: string; level: string }>[] }>;
  strengths: readonly string[];
  areasForImprovement: readonly string[];
  interventionPlan: readonly string[];
  yearEnd: string | null;
  principalComment: string | null;
  recordLine: string;
  amendmentNotice: string | null;
}>;

const LEVEL_TEXT: Record<string, string> = {
  NOT_YET_EVIDENCED: "Not yet shown",
  EMERGING: "Beginning",
  DEVELOPING: "Developing",
  SECURE: "Secure",
  ADVANCED: "Advanced",
};

const DECISION_TEXT: Record<string, string> = {
  PROMOTE: "Promoted to the next grade",
  CONDITIONAL_PROMOTION: "Promoted with a support plan",
  RETAIN: "Repeat the current grade",
  GRADUATE: "Graduated",
  PENDING_REVIEW: "Under review",
};

const titleCase = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function buildReportCardView(record: ReportCardRecord, input: {
  audience: ReportAudience;
  studentName: string;
  schoolName: string;
  periodName: string;
  yearLabel: string;
  gradeLevel: number;
}): ReportCardView {
  if ((input.audience === "STUDENT" || input.audience === "GUARDIAN") && record.status !== "PUBLISHED") throw new Error("records_view_unpublished_for_family");
  const subjects = record.subjects.map((subject) => {
    const grade = subject.percent === null ? "Not graded" : `${subject.percent}%${subject.label ? ` (${subject.label})` : ""}`;
    const result = subject.status === "NO_EVIDENCE" ? "No graded work this period"
      : subject.status === "INCOMPLETE" ? "Incomplete"
        : subject.passing === null ? ""
          : subject.passing ? (subject.meetsProficiencyTarget ? "Pass — meets proficiency target" : "Pass — below proficiency target")
            : "Below pass mark";
    const breakdown = subject.groups
      .filter((group) => group.countedEntries > 0)
      .map((group) => `${titleCase(group.groupId)} ${group.percent}% (weight ${Math.round(group.appliedWeightPercent)}%)`)
      .join("; ");
    return Object.freeze({ subject: titleCase(subject.subject), grade, result, breakdown: breakdown || "—", comment: subject.teacherComment });
  });
  const att = record.attendance;
  const attendance = att.status === "NO_RECORDS"
    ? "No attendance recorded for this period"
    : `${att.ratePercent}% attended — present ${att.present}, late ${att.late}, absent ${att.absent}, excused ${att.excused} of ${att.sessions} sessions`;
  const decision = record.yearEndDecision;
  const yearEnd = record.kind !== "YEAR_END" || decision.status === "NOT_APPLICABLE" ? null
    : decision.status === "DECIDED" && decision.outcome ? `Year-end decision: ${DECISION_TEXT[decision.outcome]}`
      : decision.status === "UNDER_APPEAL" ? "Year-end decision: under appeal"
        : "Year-end decision: pending school review";
  return Object.freeze({
    heading: `${input.schoolName} — ${record.kind === "YEAR_END" ? "Year-End Report" : "Report Card"}`,
    subheading: `${input.studentName} · Grade ${input.gradeLevel} · ${input.periodName} · ${input.yearLabel}`,
    watermark: record.status === "DRAFT" ? "DRAFT — NOT AN OFFICIAL RECORD"
      : record.status === "SUPERSEDED" ? "SUPERSEDED — SEE LATEST VERSION"
        : record.publication === "PROVISIONAL" ? "PROVISIONAL — NOT A FINAL ACADEMIC RECORD" : null,
    subjects: Object.freeze(subjects),
    attendance,
    mastery: Object.freeze({
      title: "Skill mastery (separate from grades)",
      note: "Shows which skills the student has independently demonstrated. It does not change the grades above.",
      rows: Object.freeze(record.masteryIndicators.map((indicator) => Object.freeze({ subject: titleCase(indicator.subject), objective: indicator.objectiveId, level: LEVEL_TEXT[indicator.level] ?? indicator.level }))),
    }),
    strengths: record.strengths,
    areasForImprovement: record.areasForImprovement,
    interventionPlan: record.interventionPlan,
    yearEnd,
    principalComment: record.principalComment,
    recordLine: `Record ${record.recordId} · version ${record.version} · ${record.status.toLowerCase()}${record.publishedAt ? ` ${record.publishedAt.slice(0, 10)}` : ""} · verification ${record.contentHash.slice(0, 12)}`,
    amendmentNotice: record.amendment ? `Amended ${record.amendment.at.slice(0, 10)}: ${record.amendment.reason}` : null,
  });
}
