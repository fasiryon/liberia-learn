import type { ForecastFactor, ForecastRange } from "@/lib/autonomous/predictions/types";

function asDate(value: unknown): Date | null {
  return value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
}

export function countEvents(events: any[], ...types: string[]) {
  return events.filter((event) => types.includes(event.eventType)).length;
}

export function latestSignalAt(events: any[]) {
  return events.reduce<Date | null>((latest, event) => {
    const at = asDate(event.occurredAt);
    if (!at) return latest;
    return !latest || at > latest ? at : latest;
  }, null);
}

export function evidenceRefs(events: any[], ...types: string[]) {
  return events
    .filter((event) => types.includes(event.eventType))
    .slice(0, 8)
    .map((event) => ({
      type: "LearningEvent",
      id: event.id ?? null,
      schoolId: event.schoolId ?? null,
      metadata: { eventType: event.eventType },
    }));
}

function splitWindow(events: any[], range: ForecastRange) {
  const midpoint = range.from.getTime() + (range.to.getTime() - range.from.getTime()) / 2;
  return {
    previous: events.filter((event) => {
      const at = asDate(event.occurredAt);
      return at && at.getTime() < midpoint;
    }),
    recent: events.filter((event) => {
      const at = asDate(event.occurredAt);
      return at && at.getTime() >= midpoint;
    }),
  };
}

export function trendFactor(input: {
  events: any[];
  range: ForecastRange;
  key: string;
  label: string;
  negativeWhenIncreasing?: boolean;
  eventTypes: string[];
}): ForecastFactor {
  const { previous, recent } = splitWindow(input.events, input.range);
  const previousCount = countEvents(previous, ...input.eventTypes);
  const recentCount = countEvents(recent, ...input.eventTypes);
  const delta = recentCount - previousCount;
  const negative = input.negativeWhenIncreasing !== false ? delta > 0 : delta < 0;
  const positive = input.negativeWhenIncreasing !== false ? delta < 0 : delta > 0;
  return {
    key: input.key,
    label: `${input.label}: ${recentCount} recent vs ${previousCount} previous`,
    direction: previousCount + recentCount === 0 ? "missing" : negative ? "negative" : positive ? "positive" : "mixed",
    score: Math.min(100, Math.abs(delta) * 20 + recentCount * 5),
    evidence: evidenceRefs(input.events, ...input.eventTypes),
  };
}
