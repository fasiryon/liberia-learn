import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { isPredictionReviewWorkflowEnabled } from "@/lib/serverFlags";
import { getEarlyWarnings } from "@/lib/autonomous/predictions/earlyWarningService";
import type { ForecastRange, ForecastScope, PredictionReviewInput } from "@/lib/autonomous/predictions/types";

function scopeWhere(scope: ForecastScope) {
  if (scope.aggregateSafe) return {};
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

function latestByForecast(events: any[]) {
  const latest = new Map<string, any>();
  for (const event of events) {
    const forecastId = event.metadata?.forecastId ?? event.targetId;
    if (!forecastId || latest.has(forecastId)) continue;
    latest.set(forecastId, event);
  }
  return latest;
}

function safeEvent(event: any, aggregateSafe: boolean) {
  if (!event) return null;
  return {
    id: event.id,
    schoolId: aggregateSafe ? null : event.schoolId ?? null,
    districtId: event.districtId ?? null,
    status: event.status,
    occurredAt: event.occurredAt,
    metadata: {
      forecastId: event.metadata?.forecastId ?? null,
      forecastType: event.metadata?.forecastType ?? null,
      decision: event.metadata?.decision ?? null,
      outcome: event.metadata?.outcome ?? null,
      confidenceBefore: event.metadata?.confidenceBefore ?? null,
      confidenceAfter: event.metadata?.confidenceAfter ?? null,
      rationaleLength: event.metadata?.rationaleLength ?? null,
      notesLength: event.metadata?.notesLength ?? null,
    },
  };
}

export async function getPredictionReviewQueue(input: { scope: ForecastScope; range: ForecastRange }) {
  if (!isPredictionReviewWorkflowEnabled()) {
    return { enabled: false, items: [], analytics: null, warnings: ["Prediction review workflow is disabled by feature flag."] };
  }
  const earlyWarnings = await getEarlyWarnings({ scope: input.scope, range: input.range });
  if (!earlyWarnings.enabled) return { enabled: false, items: [], analytics: null, warnings: earlyWarnings.messages };

  const [reviewEvents, outcomeEvents] = await Promise.all([
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...scopeWhere(input.scope),
        eventType: "predictive.forecast.review_recorded",
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 1000,
      select: { id: true, schoolId: true, districtId: true, targetId: true, status: true, occurredAt: true, metadata: true },
    }) ?? [],
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...scopeWhere(input.scope),
        eventType: "predictive.forecast.outcome_recorded",
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 1000,
      select: { id: true, schoolId: true, districtId: true, targetId: true, status: true, occurredAt: true, metadata: true },
    }) ?? [],
  ]);

  const reviews = latestByForecast(reviewEvents);
  const outcomes = latestByForecast(outcomeEvents);
  const aggregateSafe = input.scope.aggregateSafe === true;
  const items = earlyWarnings.warnings.map((warning) => {
    const review = safeEvent(reviews.get(warning.forecastId), aggregateSafe);
    const outcome = safeEvent(outcomes.get(warning.forecastId), aggregateSafe);
    return {
      ...warning,
      schoolId: aggregateSafe ? null : warning.schoolId,
      targetId: aggregateSafe ? null : warning.targetId,
      latestReview: review,
      latestOutcome: outcome,
      reviewState: review?.metadata.decision ?? warning.reviewState,
      outcomeState: outcome?.metadata.outcome ?? "untracked",
      reviewActions: ["acknowledged", "escalated", "dismissed", "needs_more_data"],
      outcomeActions: ["accurate", "false_positive", "missed_risk", "improved_after_intervention", "no_measurable_change"],
    };
  });

  return {
    enabled: true,
    items,
    analytics: {
      total: items.length,
      unreviewed: items.filter((item) => !item.latestReview).length,
      escalated: items.filter((item) => item.reviewState === "escalated").length,
      needsMoreData: items.filter((item) => item.reviewState === "needs_more_data").length,
      outcomesRecorded: items.filter((item) => item.latestOutcome).length,
      highRiskUnreviewed: items.filter((item) => item.riskBand === "HIGH" && !item.latestReview).length,
    },
    warnings: earlyWarnings.messages,
  };
}

export async function recordPredictionReview(input: PredictionReviewInput) {
  if (!isPredictionReviewWorkflowEnabled()) {
    throw Object.assign(new Error("Prediction review workflow is disabled"), { status: 404 });
  }
  const event = await logLearningEvent(
    {
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      actor: { type: "user", id: input.actorId ?? "system" },
      target: { type: "predictive_forecast", id: input.forecastId },
      eventType: "predictive.forecast.review_recorded",
      source: "autonomous.prediction_review",
      status: input.decision,
      dedupeKey: `predictive.review:${input.schoolId ?? input.districtId ?? "aggregate"}:${input.forecastId}:${input.decision}`,
      metadata: {
        forecastId: input.forecastId,
        forecastType: input.forecastType,
        decision: input.decision,
        confidenceScore: input.confidenceScore ?? null,
        evidenceRefCount: input.evidenceRefs?.length ?? 0,
        rationaleLength: input.rationale?.length ?? 0,
      },
      qualityMarkers: { approvalGated: true, rawPiiRedacted: true, noAutonomousAction: true, replaySafe: true },
    },
    { throwOnError: true }
  );
  await logAudit({
    userId: input.actorId ?? null,
    schoolId: input.schoolId ?? null,
    action: "predictive.forecast.review_recorded",
    resourceType: "predictive_forecast",
    resourceId: input.forecastId,
    details: { forecastType: input.forecastType, decision: input.decision },
  }).catch(() => null);
  return event;
}
