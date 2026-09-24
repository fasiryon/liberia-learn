/**
 * Small-cell suppression for WAEC readiness aggregates. Pure and dependency
 * free so every aggregate consumer (MOE panels, agent report tools) applies
 * the same rule. Matches the MOE county/dashboard minimum cohort of 5.
 */
import type { SubjectAggregate } from "@/lib/waec/aggregate";

export const NATIONAL_MIN_COHORT = 5;

export type SuppressibleSubjectAggregate = Omit<SubjectAggregate, "assessedStudents" | "atRisk" | "onTrack"> & {
  assessedStudents: number | null;
  atRisk: number | null;
  onTrack: number | null;
  suppressed: boolean;
};

export function suppressSubject(s: SubjectAggregate): SuppressibleSubjectAggregate {
  // Zero assessed stays visible as "no data"; 1-4 would re-identify learners.
  const suppressed = s.assessedStudents > 0 && s.assessedStudents < NATIONAL_MIN_COHORT;
  return suppressed
    ? { ...s, assessedStudents: null, avgReadiness: null, atRisk: null, onTrack: null, suppressed }
    : { ...s, suppressed };
}
