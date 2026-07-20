/**
 * Sprint 6.8, Escalation Point 4: learning-correlation is genuinely
 * unmeasurable today (confirmed 2026-07-18: 6 StudentPerformanceEvent rows
 * and 0 GradedSubmission rows platform-wide). This module builds only the
 * readiness check -- whether real usage volume has reached a minimum
 * sample size worth correlating -- not the correlation calculation itself.
 * Building the actual statistic now, against near-zero data, would produce
 * a number with no real meaning.
 */
import { prisma } from "@/lib/db";

const MIN_PERFORMANCE_EVENTS = 500;
const MIN_GRADED_SUBMISSIONS = 100;

export type LearningCorrelationMetric = {
  measurable: false;
  currentPerformanceEventCount: number;
  currentGradedSubmissionCount: number;
  requiredMinimumPerformanceEvents: number;
  requiredMinimumGradedSubmissions: number;
  reason: string;
};

export async function getLearningCorrelationMetric(): Promise<LearningCorrelationMetric> {
  const [currentPerformanceEventCount, currentGradedSubmissionCount] = await Promise.all([
    prisma.studentPerformanceEvent.count(),
    prisma.gradedSubmission.count(),
  ]);

  return {
    measurable: false,
    currentPerformanceEventCount,
    currentGradedSubmissionCount,
    requiredMinimumPerformanceEvents: MIN_PERFORMANCE_EVENTS,
    requiredMinimumGradedSubmissions: MIN_GRADED_SUBMISSIONS,
    reason: `Requires real pilot usage volume before any correlation would be statistically meaningful (at least ${MIN_PERFORMANCE_EVENTS} performance events and ${MIN_GRADED_SUBMISSIONS} graded submissions). Currently ${currentPerformanceEventCount} performance events and ${currentGradedSubmissionCount} graded submissions exist platform-wide.`,
  };
}
