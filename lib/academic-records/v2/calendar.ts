/**
 * Configurable academic calendars. A school's reporting periods are data, not an assumption:
 * a year may have two semesters, three terms, four or six marking periods, or any approved
 * structure. The only invariants are ordering, containment in the year and no overlap.
 */
import type { AcademicYear, Term } from "@prisma/client";
import { LL_CALENDAR_BASELINE } from "@/lib/academic-policy/llAep001";

export const ACADEMIC_RECORDS_V2_VERSION = "academic-records.v2" as const;

export type ReportingPeriod = Readonly<{
  periodId: string;
  name: string;
  order: number;
  startDate: string;
  endDate: string;
  /** Whether an official report card is issued at the end of this period. */
  issuesReport: boolean;
}>;

export type AcademicCalendar = Readonly<{
  schoolId: string;
  academicYearId: string;
  yearLabel: string;
  startDate: string;
  endDate: string;
  periods: readonly ReportingPeriod[];
  /** Year-end closeout: final report and promotion decisions happen after the last period. */
  closeout: Readonly<{ finalReportOn: string | null; promotionDecisionsBy: string | null }>;
  /** Days without instruction (holidays, closures) as YYYY-MM-DD; weekends come from `weekendDays`. */
  nonInstructionalDates: readonly string[];
  /** 0 = Sunday … 6 = Saturday. */
  weekendDays: readonly number[];
}>;

export type CalendarIssue = Readonly<{ code: string; periodId: string | null }>;

const day = (value: string) => value.slice(0, 10);

export function validateCalendar(calendar: AcademicCalendar): readonly CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  if (!calendar.schoolId || !calendar.academicYearId) issues.push({ code: "calendar_scope_required", periodId: null });
  if (!(day(calendar.startDate) < day(calendar.endDate))) issues.push({ code: "calendar_year_range_invalid", periodId: null });
  if (calendar.periods.length === 0) issues.push({ code: "calendar_periods_required", periodId: null });
  const names = new Set<string>();
  const ordered = [...calendar.periods].sort((a, b) => a.order - b.order);
  ordered.forEach((period, index) => {
    if (names.has(period.name.trim().toLowerCase())) issues.push({ code: "calendar_period_name_duplicate", periodId: period.periodId });
    names.add(period.name.trim().toLowerCase());
    if (!(day(period.startDate) <= day(period.endDate))) issues.push({ code: "calendar_period_range_invalid", periodId: period.periodId });
    if (day(period.startDate) < day(calendar.startDate) || day(period.endDate) > day(calendar.endDate)) issues.push({ code: "calendar_period_outside_year", periodId: period.periodId });
    const previous = ordered[index - 1];
    if (previous && !(day(previous.endDate) < day(period.startDate))) issues.push({ code: "calendar_periods_overlap", periodId: period.periodId });
  });
  if (!calendar.periods.some((period) => period.issuesReport)) issues.push({ code: "calendar_no_reporting_period", periodId: null });
  const last = ordered[ordered.length - 1];
  if (last && calendar.closeout.finalReportOn && day(calendar.closeout.finalReportOn) < day(last.endDate)) issues.push({ code: "calendar_final_report_before_last_period", periodId: last.periodId });
  return Object.freeze(issues);
}

const DAY_MS = 86_400_000;

export function isSchoolDay(calendar: AcademicCalendar, isoDate: string): boolean {
  const date = new Date(`${day(isoDate)}T00:00:00.000Z`);
  return !calendar.weekendDays.includes(date.getUTCDay()) && !calendar.nonInstructionalDates.includes(day(isoDate));
}

/** The date `schoolDays` school days after `fromIso` (the start day itself is not counted). */
export function addSchoolDays(calendar: AcademicCalendar, fromIso: string, schoolDays: number): string {
  if (!Number.isInteger(schoolDays) || schoolDays < 0) throw new Error("records_school_days_invalid");
  let cursor = Date.parse(`${day(fromIso)}T00:00:00.000Z`);
  let counted = 0;
  while (counted < schoolDays) {
    cursor += DAY_MS;
    if (isSchoolDay(calendar, new Date(cursor).toISOString())) counted += 1;
  }
  return new Date(cursor).toISOString().slice(0, 10);
}

/** LL-AEP-001 baseline: three reporting terms. Other structures are allowed as a documented school variant. */
export function compareToBaseline(calendar: AcademicCalendar): Readonly<{ matchesBaseline: boolean; reportingPeriods: number; baselineReportingTerms: number }> {
  const reportingPeriods = calendar.periods.filter((period) => period.issuesReport).length;
  return Object.freeze({ matchesBaseline: reportingPeriods === LL_CALENDAR_BASELINE.reportingTerms, reportingPeriods, baselineReportingTerms: LL_CALENDAR_BASELINE.reportingTerms });
}

export function findPeriod(calendar: AcademicCalendar, periodId: string): ReportingPeriod | null {
  return calendar.periods.find((period) => period.periodId === periodId) ?? null;
}

export function isFinalPeriod(calendar: AcademicCalendar, periodId: string): boolean {
  const ordered = [...calendar.periods].sort((a, b) => a.order - b.order);
  return ordered[ordered.length - 1]?.periodId === periodId;
}

/**
 * Adapter from the existing AcademicYear/Term rows. Every existing Term is treated as a reporting
 * period, ordered by start date; whether a period issues a report is an explicit input because the
 * current schema does not record it.
 */
export function calendarFromAcademicYear(
  year: Pick<AcademicYear, "id" | "schoolId" | "yearLabel" | "startDate" | "endDate">,
  terms: readonly Pick<Term, "id" | "academicYearId" | "name" | "startDate" | "endDate">[],
  options: { reportingTermIds: readonly string[] | "ALL"; nonInstructionalDates?: readonly string[]; weekendDays?: readonly number[] },
): AcademicCalendar {
  if (terms.some((term) => term.academicYearId !== year.id)) throw new Error("records_term_not_in_academic_year");
  const ordered = [...terms].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return Object.freeze({
    schoolId: year.schoolId,
    academicYearId: year.id,
    yearLabel: year.yearLabel,
    startDate: year.startDate.toISOString(),
    endDate: year.endDate.toISOString(),
    periods: Object.freeze(ordered.map((term, index) => Object.freeze({
      periodId: term.id,
      name: term.name,
      order: index + 1,
      startDate: term.startDate.toISOString(),
      endDate: term.endDate.toISOString(),
      issuesReport: options.reportingTermIds === "ALL" || options.reportingTermIds.includes(term.id),
    }))),
    closeout: { finalReportOn: null, promotionDecisionsBy: null },
    nonInstructionalDates: Object.freeze([...(options.nonInstructionalDates ?? [])]),
    weekendDays: Object.freeze([...(options.weekendDays ?? [0, 6])]),
  });
}
