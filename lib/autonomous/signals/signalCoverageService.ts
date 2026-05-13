import { prisma } from "@/lib/db";
import { PRODUCT_SIGNAL_EVENT_TYPES, categoryForEventType, type ProductSignalCategory } from "@/lib/autonomous/signals/productSignalService";

export type SignalCoverageScope = {
  schoolId?: string | null;
  aggregateSafe?: boolean;
};

export type SignalCoverageRange = {
  from: Date;
  to: Date;
};

function dateWhere(range: SignalCoverageRange) {
  return { gte: range.from, lte: range.to };
}

function scopeWhere(scope: SignalCoverageScope) {
  if (scope.schoolId) return { schoolId: scope.schoolId };
  return {};
}

function toDate(value: unknown): Date | null {
  return value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
}

function daysSince(value: Date | null, now = new Date()) {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000)));
}

function emptyCategoryRows() {
  return Object.keys(PRODUCT_SIGNAL_EVENT_TYPES).map((category) => ({
    category: category as ProductSignalCategory,
    count: 0,
    lastSeenAt: null as Date | null,
    eventTypes: PRODUCT_SIGNAL_EVENT_TYPES[category as ProductSignalCategory].map((eventType) => ({
      eventType,
      count: 0,
      lastSeenAt: null as Date | null,
    })),
  }));
}

export function parseSignalCoverageRange(input: { from?: string | null; to?: string | null } = {}, now = new Date()): SignalCoverageRange {
  const defaultFrom = new Date(now);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const parsedFrom = input.from ? new Date(`${input.from}T00:00:00.000Z`) : defaultFrom;
  const parsedTo = input.to ? new Date(`${input.to}T23:59:59.999Z`) : now;
  const from = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
  const to = Number.isNaN(parsedTo.getTime()) ? now : parsedTo;
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function getSignalCoverage(input: { scope?: SignalCoverageScope; range: SignalCoverageRange }) {
  const scope = input.scope ?? {};
  const events = await (prisma as any).learningEvent.findMany({
    where: {
      ...scopeWhere(scope),
      eventType: { in: Object.values(PRODUCT_SIGNAL_EVENT_TYPES).flat() },
      occurredAt: dateWhere(input.range),
    },
    orderBy: { occurredAt: "desc" },
    take: 5000,
    select: {
      id: true,
      eventType: true,
      occurredAt: true,
      schoolId: true,
      classId: true,
      studentId: true,
      targetType: true,
      targetId: true,
      metadata: true,
    },
  });

  const categoryRows = emptyCategoryRows();
  const byCategory = new Map(categoryRows.map((row) => [row.category, row]));
  const schools = new Set<string>();
  const classes = new Set<string>();
  const detectorSignalTypes = new Set<string>();

  for (const event of events) {
    const category = categoryForEventType(event.eventType);
    if (!category) continue;
    const row = byCategory.get(category);
    if (!row) continue;
    const occurredAt = toDate(event.occurredAt);
    row.count += 1;
    if (occurredAt && (!row.lastSeenAt || occurredAt > row.lastSeenAt)) row.lastSeenAt = occurredAt;
    const typeRow = row.eventTypes.find((entry) => entry.eventType === event.eventType);
    if (typeRow) {
      typeRow.count += 1;
      if (occurredAt && (!typeRow.lastSeenAt || occurredAt > typeRow.lastSeenAt)) typeRow.lastSeenAt = occurredAt;
    }
    if (event.schoolId) schools.add(event.schoolId);
    if (event.classId) classes.add(event.classId);
    detectorSignalTypes.add(event.eventType);
  }

  const staleWarnings = categoryRows
    .filter((row) => row.count > 0 && daysSince(row.lastSeenAt) !== null && Number(daysSince(row.lastSeenAt)) > 7)
    .map((row) => `${row.category} signals are stale; last seen ${daysSince(row.lastSeenAt)} days ago.`);
  const missingTypes = categoryRows.flatMap((row) => row.eventTypes.filter((entry) => entry.count === 0).map((entry) => entry.eventType));
  const lowDataWarnings = categoryRows.filter((row) => row.count === 0).map((row) => `${row.category} has no LearningEvent coverage in this window.`);

  const decisions = await (prisma as any).agentDecision.findMany({
    where: {
      decisionType: { startsWith: "detector.recommendation." },
      createdAt: dateWhere(input.range),
    },
    take: 1000,
    select: { id: true, decisionType: true, evidenceRefs: true, createdAt: true },
  });

  const decisionsWithLearningEvents = decisions.filter((decision: any) =>
    Array.isArray(decision.evidenceRefs?.refs) && decision.evidenceRefs.refs.some((ref: any) => ref?.type === "LearningEvent")
  ).length;

  return {
    range: input.range,
    scope: { schoolId: scope.schoolId ?? null, aggregateSafe: scope.aggregateSafe === true },
    totalEvents: events.length,
    byCategory: categoryRows,
    freshness: {
      lastSeenAt: categoryRows.reduce<Date | null>((latest, row) => (!row.lastSeenAt || (latest && latest > row.lastSeenAt) ? latest : row.lastSeenAt), null),
      staleWarnings,
    },
    coverage: {
      schoolCount: scope.aggregateSafe ? null : schools.size,
      classCount: scope.aggregateSafe ? null : classes.size,
      detectorEvidenceCoverage: decisions.length > 0 ? Number((decisionsWithLearningEvents / decisions.length).toFixed(3)) : null,
      detectorRecommendations: decisions.length,
      detectorRecommendationsWithLearningEvents: decisionsWithLearningEvents,
      detectorSignalTypes: Array.from(detectorSignalTypes).sort(),
    },
    warnings: [...lowDataWarnings, ...staleWarnings],
    topMissingSignalTypes: missingTypes.slice(0, 12),
  };
}

