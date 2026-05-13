import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { recordOperationalMemory } from "@/lib/autonomous/memory/operationalMemoryService";
import { calibrateConfidence, scoreEvidenceCoverage } from "@/lib/autonomous/evaluation/confidenceCalibrationService";
import type { ForecastOutcomeInput } from "@/lib/autonomous/predictions/types";

function outcomeToEvaluation(outcome: ForecastOutcomeInput["outcome"]) {
  if (outcome === "accurate" || outcome === "improved_after_intervention") return "improved" as const;
  if (outcome === "false_positive") return "false_positive" as const;
  if (outcome === "missed_risk") return "no_measurable_change" as const;
  return "no_measurable_change" as const;
}

export async function recordForecastOutcome(input: ForecastOutcomeInput) {
  const confidenceAfter = calibrateConfidence({
    confidenceBefore: input.confidenceBefore ?? 0.45,
    outcome: outcomeToEvaluation(input.outcome),
    evidenceCoverageScore: scoreEvidenceCoverage({ refs: input.evidenceRefs ?? [] }),
    effectivenessScore: input.outcome === "improved_after_intervention" ? 0.85 : input.outcome === "accurate" ? 0.7 : 0.25,
  });
  const event = await logLearningEvent(
    {
      schoolId: input.schoolId ?? null,
      districtId: input.districtId ?? null,
      actor: { type: "user", id: input.actorId ?? "system" },
      target: { type: "predictive_forecast", id: input.forecastId },
      eventType: "predictive.forecast.outcome_recorded",
      source: "autonomous.predictions",
      status: input.outcome,
      dedupeKey: `predictive.outcome:${input.schoolId ?? input.districtId ?? "aggregate"}:${input.forecastId}:${input.outcome}`,
      metadata: {
        forecastId: input.forecastId,
        forecastType: input.forecastType,
        outcome: input.outcome,
        confidenceBefore: input.confidenceBefore ?? null,
        confidenceAfter,
        calibrationVersion: "deterministic-v1",
        notesLength: input.notes?.length ?? 0,
      },
      qualityMarkers: { replaySafe: true, rawPiiRedacted: true, governanceSafe: true },
    },
    { throwOnError: true }
  );

  await recordOperationalMemory({
    scope: input.schoolId ? "school" : input.districtId ? "district" : "national",
    schoolId: input.schoolId ?? null,
    districtId: input.districtId ?? null,
    actorId: input.actorId ?? null,
    memoryType: input.schoolId ? "SCHOOL_PATTERN" : input.districtId ? "DISTRICT_PATTERN" : "NATIONAL_PATTERN",
    summary: `Forecast ${input.forecastType} outcome recorded as ${input.outcome}; confidence recalibrated to ${confidenceAfter}.`,
    evidenceRefs: { refs: input.evidenceRefs ?? [] },
    lineage: { forecastId: input.forecastId, eventId: (event as any)?.id ?? null },
    confidence: confidenceAfter,
    sensitivity: input.schoolId ? "tenant" : "aggregate",
    targetType: "predictive_forecast",
    targetId: input.forecastId,
    retentionDays: 365,
  }).catch(() => null);

  return { event, confidenceAfter };
}

export async function recordForecastTrace(input: { forecastId: string; forecastType: string; schoolId?: string | null; districtId?: string | null; evidenceRefs?: any[] }) {
  return logLearningEvent({
    schoolId: input.schoolId ?? null,
    districtId: input.districtId ?? null,
    actor: { type: "system", id: "forecastingTraceService" },
    target: { type: "predictive_forecast", id: input.forecastId },
    eventType: "predictive.forecast.generated",
    source: "autonomous.predictions",
    metadata: { forecastType: input.forecastType, evidenceRefCount: input.evidenceRefs?.length ?? 0 },
    qualityMarkers: { replaySafe: true, readOnlyForecast: true },
  });
}
