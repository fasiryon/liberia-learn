import { getPredictiveIntelligence } from "@/lib/autonomous/predictions/predictiveIntelligenceService";
import type { ForecastRange, ForecastScope } from "@/lib/autonomous/predictions/types";

export async function getInstitutionalForecast(input: { scope: ForecastScope; range: ForecastRange }) {
  const aggregateScope = { ...input.scope, aggregateSafe: true };
  const result = await getPredictiveIntelligence({
    scope: aggregateScope,
    range: input.range,
    types: ["school_operational_risk", "district_national_aggregate", "curriculum_weakness", "teacher_support", "guardian_engagement"],
  });
  if (!result.enabled) return { enabled: false, forecasts: [], analytics: null, warnings: result.warnings };
  return {
    enabled: true,
    forecasts: result.forecasts.map((forecast) => ({
      ...forecast,
      schoolId: null,
      targetId: null,
      aggregateSafe: true,
      warnings: [...forecast.warnings, "Institutional forecast is aggregate-safe; raw PII and school/class/student identifiers are suppressed."],
    })),
    analytics: result.analytics,
    warnings: result.warnings,
  };
}
