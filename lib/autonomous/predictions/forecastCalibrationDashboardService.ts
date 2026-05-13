import { prisma } from "@/lib/db";
import { isPredictionReviewWorkflowEnabled } from "@/lib/serverFlags";
import type { ForecastRange, ForecastScope } from "@/lib/autonomous/predictions/types";

function scopeWhere(scope: ForecastScope) {
  if (scope.aggregateSafe) return {};
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

function avg(values: number[]) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : null;
}

export async function getForecastCalibrationDashboard(input: { scope: ForecastScope; range: ForecastRange }) {
  if (!isPredictionReviewWorkflowEnabled()) {
    return { enabled: false, analytics: null, byType: [], recentOutcomes: [], warnings: ["Prediction review workflow is disabled by feature flag."] };
  }
  const [outcomes, reviews] = await Promise.all([
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...scopeWhere(input.scope),
        eventType: "predictive.forecast.outcome_recorded",
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 1000,
      select: { id: true, schoolId: true, districtId: true, status: true, occurredAt: true, metadata: true },
    }) ?? [],
    (prisma as any).learningEvent?.findMany?.({
      where: {
        ...scopeWhere(input.scope),
        eventType: "predictive.forecast.review_recorded",
        occurredAt: { gte: input.range.from, lte: input.range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 1000,
      select: { id: true, schoolId: true, districtId: true, status: true, occurredAt: true, metadata: true },
    }) ?? [],
  ]);

  const total = outcomes.length;
  const accurate = outcomes.filter((event: any) => event.metadata?.outcome === "accurate").length;
  const falsePositive = outcomes.filter((event: any) => event.metadata?.outcome === "false_positive").length;
  const missedRisk = outcomes.filter((event: any) => event.metadata?.outcome === "missed_risk").length;
  const improved = outcomes.filter((event: any) => event.metadata?.outcome === "improved_after_intervention").length;
  const confidenceBefore = outcomes.map((event: any) => Number(event.metadata?.confidenceBefore)).filter(Number.isFinite);
  const confidenceAfter = outcomes.map((event: any) => Number(event.metadata?.confidenceAfter)).filter(Number.isFinite);
  const forecastTypes = Array.from(new Set(outcomes.map((event: any) => String(event.metadata?.forecastType ?? "unknown"))));

  return {
    enabled: true,
    analytics: {
      totalOutcomes: total,
      reviewsRecorded: reviews.length,
      forecastAccuracy: total ? Number(((accurate + improved) / total).toFixed(3)) : null,
      falsePositiveRate: total ? Number((falsePositive / total).toFixed(3)) : null,
      missedRiskRate: total ? Number((missedRisk / total).toFixed(3)) : null,
      averageConfidenceBefore: avg(confidenceBefore),
      averageConfidenceAfter: avg(confidenceAfter),
      calibrationMovement:
        avg(confidenceBefore) === null || avg(confidenceAfter) === null ? null : Number((Number(avg(confidenceAfter)) - Number(avg(confidenceBefore))).toFixed(3)),
    },
    byType: forecastTypes.map((forecastType) => {
      const rows = outcomes.filter((event: any) => String(event.metadata?.forecastType ?? "unknown") === forecastType);
      return {
        forecastType,
        total: rows.length,
        accurate: rows.filter((event: any) => event.metadata?.outcome === "accurate" || event.metadata?.outcome === "improved_after_intervention").length,
        falsePositive: rows.filter((event: any) => event.metadata?.outcome === "false_positive").length,
        missedRisk: rows.filter((event: any) => event.metadata?.outcome === "missed_risk").length,
      };
    }),
    recentOutcomes: outcomes.slice(0, 20).map((event: any) => ({
      id: event.id,
      schoolId: input.scope.aggregateSafe ? null : event.schoolId ?? null,
      districtId: event.districtId ?? null,
      occurredAt: event.occurredAt,
      forecastId: event.metadata?.forecastId ?? null,
      forecastType: event.metadata?.forecastType ?? null,
      outcome: event.metadata?.outcome ?? event.status,
      confidenceBefore: event.metadata?.confidenceBefore ?? null,
      confidenceAfter: event.metadata?.confidenceAfter ?? null,
    })),
    warnings: [
      ...(total < 5 ? ["Fewer than five forecast outcomes recorded; calibration should be treated as low confidence."] : []),
      ...(input.scope.aggregateSafe ? ["Aggregate-safe calibration view suppresses school, class, student, and user identifiers."] : []),
    ],
  };
}
