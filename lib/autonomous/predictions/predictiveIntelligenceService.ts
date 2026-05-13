import { isPredictiveIntelligenceEnabled } from "@/lib/serverFlags";
import { getSignalCoverage } from "@/lib/autonomous/signals/signalCoverageService";
import { loadPredictiveEvidence } from "@/lib/autonomous/predictions/predictiveEvidenceService";
import { calculateConfidence, classifyRiskBand, classifyTrajectory } from "@/lib/autonomous/predictions/riskTrajectoryService";
import { countEvents, evidenceRefs, latestSignalAt, trendFactor } from "@/lib/autonomous/predictions/trendForecastService";
import type { ForecastFactor, ForecastRange, ForecastScope, ForecastType, PredictiveForecast } from "@/lib/autonomous/predictions/types";

const FORECAST_VERSION = "predictive-deterministic-v1";

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function refRows(rows: any[], type: string) {
  return rows.slice(0, 6).map((row) => ({ type, id: row.id ?? null, schoolId: row.schoolId ?? null }));
}

function safeTarget(scope: ForecastScope, targetType: string, targetId?: string | null) {
  return scope.aggregateSafe ? { targetType, targetId: null, schoolId: null } : { targetType, targetId: targetId ?? scope.schoolId ?? scope.districtId ?? targetType, schoolId: scope.schoolId ?? null };
}

function riskScore(factors: ForecastFactor[]) {
  const negative = factors.filter((factor) => factor.direction === "negative").map((factor) => factor.score);
  const missingPenalty = factors.filter((factor) => factor.direction === "missing").length * 8;
  return Math.min(100, Math.round(avg(negative) + missingPenalty));
}

function actionSet(type: ForecastType, riskBand: string) {
  const review = riskBand === "HIGH" ? "Escalate for human review before any intervention." : "Queue for staff review; recommendation-only.";
  const actions: Record<ForecastType, string[]> = {
    student_risk: [review, "Ask teacher to review attendance, work completion, and recent intervention notes.", "Offer guardian outreach draft for approval."],
    guardian_engagement: [review, "Review recent guardian contact attempts.", "Prepare non-punitive follow-up reminder for approval."],
    curriculum_weakness: [review, "Review affected standards and recent remediation outcomes.", "Propose teacher support or curriculum review queue item."],
    teacher_support: [review, "Review grading backlog and class load.", "Offer admin support recommendation; no workload change without approval."],
    school_operational_risk: [review, "Review attendance, compliance, and unresolved intervention queues.", "Escalate to school leadership dashboard."],
    district_national_aggregate: [review, "Review aggregate trend with suppression-safe evidence only.", "Prepare MOE briefing draft; no policy change."],
  };
  return actions[type];
}

function buildForecast(input: {
  type: ForecastType;
  scope: ForecastScope;
  range: ForecastRange;
  factors: ForecastFactor[];
  events: any[];
  decisions: any[];
  workflowRuns: any[];
  memoryEvents: any[];
  evaluationEvents: any[];
  targetType: string;
  targetId?: string | null;
  warnings?: string[];
}): PredictiveForecast {
  const score = riskScore(input.factors);
  const riskBand = classifyRiskBand(score);
  const trajectory = classifyTrajectory(input.factors);
  const lastSignal = latestSignalAt(input.events);
  const consistentOutcomes = input.evaluationEvents.filter((event) => ["accurate", "improved_after_intervention"].includes(String(event.metadata?.outcome))).length;
  const conflicting = input.factors.filter((factor) => factor.direction === "mixed").length;
  const confidence = calculateConfidence({
    evidenceCount: input.factors.flatMap((factor) => factor.evidence).length,
    lastSignalAt: lastSignal,
    conflictingEvidenceCount: conflicting,
    historicalOutcomeSupport: Math.min(0.18, consistentOutcomes * 0.04),
  });
  const target = safeTarget(input.scope, input.targetType, input.targetId);
  const aggregateSafe = input.scope.aggregateSafe === true;
  const evidence = input.factors.flatMap((factor) => factor.evidence);
  const stale = !lastSignal || Date.now() - lastSignal.getTime() > 10 * 86400000;

  return {
    id: `${input.type}:${target.targetId ?? "aggregate"}:${input.range.from.toISOString().slice(0, 10)}:${input.range.to.toISOString().slice(0, 10)}`,
    type: input.type,
    targetType: target.targetType,
    targetId: target.targetId,
    schoolId: aggregateSafe ? null : target.schoolId,
    districtId: input.scope.districtId ?? null,
    aggregateSafe,
    trajectory,
    riskBand,
    confidenceScore: confidence.score,
    confidenceBand: confidence.band,
    confidenceRationale: confidence.rationale,
    contributingFactors: input.factors,
    evidenceRefs: evidence,
    historicalTrendBasis: `${FORECAST_VERSION}; ${input.events.length} LearningEvent rows, ${input.decisions.length} AgentDecision rows, ${input.workflowRuns.length} WorkflowRun rows.`,
    evaluationSupport: {
      evaluationEvents: input.evaluationEvents.length,
      consistentOutcomes,
      priorFalsePositiveOutcomes: input.evaluationEvents.filter((event) => event.metadata?.outcome === "false_positive").length,
    },
    memoryLineageRefs: refRows(input.memoryEvents, "LearningEvent"),
    recommendedActions: actionSet(input.type, riskBand),
    warnings: [
      ...(input.warnings ?? []),
      ...(trajectory === "unknown" ? ["Insufficient data for a directional trajectory."] : []),
      ...(stale ? ["Signals are stale; confidence is degraded."] : []),
      ...(aggregateSafe ? ["Aggregate-safe view: school, class, student, and user identifiers are suppressed."] : []),
    ],
    forecastFreshness: { generatedAt: new Date(), lastSignalAt: lastSignal, stale },
  };
}

function forecastFactors(type: ForecastType, evidence: Awaited<ReturnType<typeof loadPredictiveEvidence>>, range: ForecastRange): ForecastFactor[] {
  const events = evidence.events;
  if (type === "student_risk") {
    return [
      trendFactor({ events, range, key: "attendance_decline", label: "Attendance risk signals", eventTypes: ["attendance.updated", "live_session.attendance_marked"] }),
      trendFactor({ events, range, key: "assignment_completion_decline", label: "Assignment submission pressure", eventTypes: ["assignment.submitted"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "grading_deterioration", label: "Low grading / feedback recovery", eventTypes: ["assignment.graded", "teacher.feedback.created"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "lesson_inactivity", label: "Lesson inactivity", eventTypes: ["lesson.started", "lesson.completed"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "guardian_disengagement", label: "Guardian follow-through", eventTypes: ["guardian.report_card.viewed"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "live_absenteeism", label: "Live session participation", eventTypes: ["live_session.joined"], negativeWhenIncreasing: false }),
    ];
  }
  if (type === "guardian_engagement") {
    return [
      trendFactor({ events, range, key: "report_card_views", label: "Report-card view trend", eventTypes: ["guardian.report_card.viewed"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "communication_response", label: "Guardian communication response", eventTypes: ["guardian.message.received", "push.notification.opened"], negativeWhenIncreasing: false }),
      trendFactor({ events, range, key: "attendance_acknowledgment", label: "Attendance acknowledgement proxy", eventTypes: ["attendance.updated"], negativeWhenIncreasing: false }),
    ];
  }
  if (type === "curriculum_weakness") {
    return [
      trendFactor({ events, range, key: "assignment_difficulty_cluster", label: "Assignment difficulty cluster", eventTypes: ["assignment.submitted", "assignment.graded"] }),
      trendFactor({ events, range, key: "repeated_remediation", label: "Repeated remediation / tutor pressure", eventTypes: ["ai.interaction", "teacher.feedback.created"] }),
      trendFactor({ events, range, key: "low_mastery_movement", label: "Lesson completion conversion", eventTypes: ["lesson.started", "lesson.completed"], negativeWhenIncreasing: false }),
    ];
  }
  if (type === "teacher_support") {
    return [
      { key: "grading_backlog", label: "Submitted assignments not yet matched by grading signals", direction: countEvents(events, "assignment.submitted") > countEvents(events, "assignment.graded") ? "negative" : "positive", score: Math.min(100, Math.max(0, countEvents(events, "assignment.submitted") - countEvents(events, "assignment.graded")) * 15), evidence: evidenceRefs(events, "assignment.submitted", "assignment.graded") },
      trendFactor({ events, range, key: "intervention_load", label: "Intervention and feedback load", eventTypes: ["teacher.feedback.created", "report_card.comment_updated"] }),
      trendFactor({ events, range, key: "class_performance_deterioration", label: "Class lesson completion pressure", eventTypes: ["lesson.completed"], negativeWhenIncreasing: false }),
    ];
  }
  if (type === "school_operational_risk") {
    return [
      trendFactor({ events, range, key: "attendance_deterioration", label: "Attendance deterioration", eventTypes: ["attendance.updated", "offline.sync.attendance.accepted"] }),
      { key: "workflow_instability", label: "Failed or dead-lettered autonomous workflows", direction: evidence.workflowRuns.some((run: any) => ["failed", "dead_lettered"].includes(run.status)) ? "negative" : "positive", score: evidence.workflowRuns.filter((run: any) => ["failed", "dead_lettered"].includes(run.status)).length * 20, evidence: refRows(evidence.workflowRuns, "WorkflowRun") },
      trendFactor({ events, range, key: "low_guardian_engagement", label: "Guardian engagement movement", eventTypes: ["guardian.report_card.viewed", "push.notification.opened"], negativeWhenIncreasing: false }),
    ];
  }
  return [
    trendFactor({ events, range, key: "aggregate_attendance_trends", label: "Aggregate attendance trend", eventTypes: ["attendance.updated", "offline.sync.attendance.accepted"] }),
    trendFactor({ events, range, key: "curriculum_performance_trends", label: "Aggregate curriculum performance trend", eventTypes: ["lesson.completed", "assignment.graded"], negativeWhenIncreasing: false }),
    trendFactor({ events, range, key: "engagement_deterioration", label: "Aggregate engagement trend", eventTypes: ["guardian.report_card.viewed", "live_session.joined", "push.notification.opened"], negativeWhenIncreasing: false }),
  ];
}

export async function getPredictiveIntelligence(input: { scope: ForecastScope; range: ForecastRange; types?: ForecastType[]; targetId?: string | null }) {
  if (!isPredictiveIntelligenceEnabled()) {
    return { enabled: false, forecasts: [] as PredictiveForecast[], analytics: null, warnings: ["Predictive intelligence is disabled by feature flag."] };
  }
  const evidence = await loadPredictiveEvidence(input);
  const signalCoverage = await getSignalCoverage({ scope: { schoolId: input.scope.aggregateSafe ? null : input.scope.schoolId ?? null, aggregateSafe: input.scope.aggregateSafe }, range: input.range });
  const types = input.types ?? ["student_risk", "guardian_engagement", "curriculum_weakness", "teacher_support", "school_operational_risk", "district_national_aggregate"];
  const forecasts = types.map((type) =>
    buildForecast({
      type,
      scope: type === "district_national_aggregate" ? { ...input.scope, aggregateSafe: true } : input.scope,
      range: input.range,
      factors: forecastFactors(type, evidence, input.range),
      events: evidence.events,
      decisions: evidence.decisions,
      workflowRuns: evidence.workflowRuns,
      memoryEvents: evidence.memoryEvents,
      evaluationEvents: evidence.evaluationEvents,
      targetType: type === "student_risk" ? "student" : type === "district_national_aggregate" ? "aggregate" : "school",
      targetId: input.targetId,
      warnings: signalCoverage.warnings.slice(0, 4),
    })
  );
  return {
    enabled: true,
    forecasts,
    analytics: {
      totalForecasts: forecasts.length,
      highRisk: forecasts.filter((forecast) => forecast.riskBand === "HIGH").length,
      mediumRisk: forecasts.filter((forecast) => forecast.riskBand === "MEDIUM").length,
      lowConfidence: forecasts.filter((forecast) => forecast.confidenceBand === "LOW").length,
      staleForecasts: forecasts.filter((forecast) => forecast.forecastFreshness.stale).length,
      aggregateSafeForecasts: forecasts.filter((forecast) => forecast.aggregateSafe).length,
      signalCoverage: signalCoverage.totalEvents,
      detectorEvidenceCoverage: signalCoverage.coverage.detectorEvidenceCoverage,
    },
    warnings: [...new Set(forecasts.flatMap((forecast) => forecast.warnings))],
  };
}
