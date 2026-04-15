// lib/analytics/interventionEffectiveness.ts — Sprint 7
// Intervention effectiveness analytics using Sprint 3 InterventionChain data.
// Internal API only.

import { prisma } from "@/lib/db";

export interface InterventionEffectivenessReport {
  totalChains: number;
  closedChains: number;
  closureRatePct: number;
  byAttributionSource: Array<{
    source: string;
    count: number;
    closedCount: number;
    closureRatePct: number;
  }>;
  avgDaysToClose: number | null;
}

export interface InterventionEffectivenessOptions {
  schoolId?: string | null;
  since?: Date;
}

export async function getInterventionEffectiveness(
  options: InterventionEffectivenessOptions = {}
): Promise<InterventionEffectivenessReport> {
  const { schoolId, since } = options;

  const chains = await prisma.interventionChain.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      ...(since ? { openedAt: { gte: since } } : {}),
    },
    select: {
      status: true,
      attributionSource: true,
      openedAt: true,
      closedAt: true,
    },
  });

  if (chains.length === 0) {
    return {
      totalChains: 0,
      closedChains: 0,
      closureRatePct: 0,
      byAttributionSource: [],
      avgDaysToClose: null,
    };
  }

  const closed = chains.filter((c) => c.status === "closed" || c.closedAt != null);
  const closureRatePct =
    chains.length > 0 ? Math.round((closed.length / chains.length) * 10000) / 100 : 0;

  // Avg days to close
  const closeDays = closed
    .filter((c) => c.closedAt != null)
    .map((c) => (c.closedAt!.getTime() - c.openedAt.getTime()) / (1000 * 60 * 60 * 24))
    .filter((d) => d >= 0);
  const avgDaysToClose =
    closeDays.length > 0
      ? Math.round((closeDays.reduce((a, b) => a + b, 0) / closeDays.length) * 100) / 100
      : null;

  // By attribution source
  const sourceMap = new Map<string, { count: number; closed: number }>();
  for (const c of chains) {
    const key = c.attributionSource ?? "unknown";
    const entry = sourceMap.get(key) ?? { count: 0, closed: 0 };
    entry.count += 1;
    if (c.status === "closed" || c.closedAt != null) entry.closed += 1;
    sourceMap.set(key, entry);
  }

  const byAttributionSource = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      count: data.count,
      closedCount: data.closed,
      closureRatePct: data.count > 0 ? Math.round((data.closed / data.count) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalChains: chains.length,
    closedChains: closed.length,
    closureRatePct,
    byAttributionSource,
    avgDaysToClose,
  };
}
