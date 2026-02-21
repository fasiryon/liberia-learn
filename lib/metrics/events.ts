import { prisma } from "@/lib/db";
import type { ReportScope } from "@/lib/reporting/scope";

type MetricEventScope = {
  scope: ReportScope;
  scopeId: string | null;
  schoolId?: string | null;
};

type TrendPoint = {
  day: string;
  count: number;
};

export async function recordMetricEvent(
  name: string,
  payload: Record<string, unknown> | null,
  scope: MetricEventScope & {
    kind?: string;
    severity?: "info" | "warning" | "error";
    pilotOnly?: boolean;
    userId?: string | null;
  }
) {
  return prisma.metricEvent.create({
    data: {
      name,
      kind: scope.kind ?? "counter",
      severity: scope.severity ?? "info",
      scope: scope.scope,
      scopeId: scope.scopeId,
      schoolId: scope.schoolId ?? null,
      userId: scope.userId ?? null,
      payloadJson: payload ?? undefined,
      pilotOnly: scope.pilotOnly ?? true,
    },
  });
}

function parseRangeDays(range: string | null | undefined): number {
  const normalized = (range ?? "7d").toLowerCase();
  if (normalized === "7d") return 7;
  if (normalized === "30d") return 30;
  throw Object.assign(new Error("Invalid range"), { status: 400 });
}

export function buildMetricScopeWhere(scope: ReportScope, scopeId: string | null) {
  if (scope === "school") {
    if (!scopeId) throw Object.assign(new Error("Missing scopeId"), { status: 400 });
    return {
      OR: [
        { scope: "school", scopeId },
        { schoolId: scopeId },
      ],
    };
  }
  if (scope === "county") {
    if (!scopeId) throw Object.assign(new Error("Missing scopeId"), { status: 400 });
    return {
      OR: [
        { scope: "county", scopeId },
        { school: { county: scopeId } },
      ],
    };
  }
  if (scope === "district") {
    if (!scopeId) throw Object.assign(new Error("Missing scopeId"), { status: 400 });
    return {
      OR: [
        { scope: "district", scopeId },
        { school: { district: scopeId } },
      ],
    };
  }
  return {};
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildDailyTrend(events: Array<{ createdAt: Date }>, days: number): TrendPoint[] {
  const today = new Date();
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    buckets.set(dayKey(d), 0);
  }
  for (const event of events) {
    const key = dayKey(new Date(event.createdAt));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, count]) => ({ day, count }));
}

function payloadNumber(payload: any, key: string): number {
  const value = payload?.[key];
  return typeof value === "number" ? value : 0;
}

export async function aggregateMetrics({
  scope,
  scopeId,
  range,
}: {
  scope: ReportScope;
  scopeId: string | null;
  range?: "7d" | "30d";
}) {
  const days = parseRangeDays(range);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  const events = await prisma.metricEvent.findMany({
    where: {
      pilotOnly: true,
      createdAt: { gte: from },
      ...buildMetricScopeWhere(scope, scopeId),
    },
    select: {
      name: true,
      severity: true,
      payloadJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const syncAttempts = events.filter((e) => e.name === "sync.attempt").length;
  const syncFailures = events.filter((e) => e.name === "sync.failure").length;
  const syncResults = events.filter((e) => e.name === "sync.result");
  const syncConflicts = syncResults.reduce((acc, e) => acc + payloadNumber(e.payloadJson, "conflicts"), 0);
  const syncProcessed = syncResults.reduce((acc, e) => acc + payloadNumber(e.payloadJson, "processed"), 0);

  const smsSent = events.filter((e) => e.name === "sms.sent").length;
  const smsFailures = events.filter((e) => e.name === "sms.failed").length;
  const smsRetries = events.filter((e) => e.name === "sms.retry").length;
  const smsBlocked = events.filter((e) => e.name === "sms.blocked.opted_out").length;

  const exportGenerated = events.filter((e) => e.name === "export.generated");
  const exportFailed = events.filter((e) => e.name === "export.failed").length;

  const exportByType: Record<string, number> = {};
  for (const row of exportGenerated) {
    const type = String((row.payloadJson as any)?.exportType ?? "unknown");
    exportByType[type] = (exportByType[type] ?? 0) + 1;
  }

  return {
    offline: {
      pending: events.filter((e) => e.name === "offline.queue.pending").reduce((acc, e) => acc + payloadNumber(e.payloadJson, "count"), 0),
      conflicts: events.filter((e) => e.name === "offline.queue.conflicts").reduce((acc, e) => acc + payloadNumber(e.payloadJson, "count"), 0),
      deadLetter: events.filter((e) => e.name === "offline.queue.dead_letter").reduce((acc, e) => acc + payloadNumber(e.payloadJson, "count"), 0),
      trend: buildDailyTrend(events.filter((e) => e.name.startsWith("offline.queue.")), days),
    },
    sync: {
      syncAttempts,
      syncFailures,
      conflictRate: syncProcessed > 0 ? syncConflicts / syncProcessed : 0,
      trend: buildDailyTrend(events.filter((e) => e.name.startsWith("sync.")), days),
    },
    sms: {
      sendCount: smsSent,
      failureRate: smsSent + smsFailures > 0 ? smsFailures / (smsSent + smsFailures) : 0,
      retryCount: smsRetries,
      optedOutBlockedCount: smsBlocked,
      trend: buildDailyTrend(events.filter((e) => e.name.startsWith("sms.")), days),
    },
    exports: {
      exportCount: exportGenerated.length,
      failures: exportFailed,
      byType: exportByType,
      trend: buildDailyTrend(events.filter((e) => e.name.startsWith("export.")), days),
    },
  };
}

