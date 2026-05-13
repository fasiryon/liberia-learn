import { getPredictiveIntelligence } from "@/lib/autonomous/predictions/predictiveIntelligenceService";
import type { ForecastRange, ForecastScope, PredictiveForecast } from "@/lib/autonomous/predictions/types";

export function forecastToEarlyWarning(forecast: PredictiveForecast) {
  return {
    id: `warning:${forecast.id}`,
    forecastId: forecast.id,
    type: forecast.type,
    targetType: forecast.targetType,
    targetId: forecast.targetId,
    schoolId: forecast.aggregateSafe ? null : forecast.schoolId,
    districtId: forecast.districtId,
    riskBand: forecast.riskBand,
    trajectory: forecast.trajectory,
    confidenceScore: forecast.confidenceScore,
    confidenceBand: forecast.confidenceBand,
    evidenceRefs: forecast.evidenceRefs,
    contributingFactors: forecast.contributingFactors,
    recommendedActions: forecast.recommendedActions,
    approvalRequired: true,
    executionMode: "recommendation_only",
    reviewState: "needs_review",
    replaySafe: true,
    warnings: forecast.warnings,
  };
}

export async function getEarlyWarnings(input: { scope: ForecastScope; range: ForecastRange }) {
  const result = await getPredictiveIntelligence({ scope: input.scope, range: input.range });
  if (!result.enabled) return { enabled: false, warnings: [], analytics: null, messages: result.warnings };
  const warnings = result.forecasts
    .filter((forecast) => forecast.riskBand !== "LOW" || forecast.trajectory === "deteriorating" || forecast.confidenceBand === "LOW")
    .map(forecastToEarlyWarning);
  return {
    enabled: true,
    warnings,
    analytics: {
      totalWarnings: warnings.length,
      approvalGated: warnings.filter((warning) => warning.approvalRequired).length,
      highRisk: warnings.filter((warning) => warning.riskBand === "HIGH").length,
      lowConfidence: warnings.filter((warning) => warning.confidenceBand === "LOW").length,
      staleOrSparse: warnings.filter((warning) => warning.warnings.length > 0).length,
    },
    messages: result.warnings,
  };
}
