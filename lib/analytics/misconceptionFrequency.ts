// lib/analytics/misconceptionFrequency.ts — Sprint 7
// Misconception frequency analytics using Sprint 3 MisconceptionTag data.
// Internal API only.

import { prisma } from "@/lib/db";

export interface MisconceptionFrequencyReport {
  totalTags: number;
  activeTagCount: number;
  resolvedTagCount: number;
  topCategories: Array<{
    categoryId: string;
    count: number;
    activePct: number;
    avgConfidence: number | null;
  }>;
  byOrigin: Array<{
    origin: string;
    count: number;
  }>;
}

export interface MisconceptionFrequencyOptions {
  schoolId?: string | null;
  since?: Date;
  topN?: number;
}

export async function getMisconceptionFrequency(
  options: MisconceptionFrequencyOptions = {}
): Promise<MisconceptionFrequencyReport> {
  const { schoolId, since, topN = 10 } = options;

  const tags = await prisma.misconceptionTag.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      categoryId: true,
      status: true,
      origin: true,
      confidence: true,
    },
  });

  if (tags.length === 0) {
    return { totalTags: 0, activeTagCount: 0, resolvedTagCount: 0, topCategories: [], byOrigin: [] };
  }

  const activeCount = tags.filter((t) => t.status === "active").length;
  const resolvedCount = tags.filter((t) => t.status === "resolved").length;

  // By category
  const catMap = new Map<string, { count: number; active: number; confidences: number[] }>();
  for (const t of tags) {
    const entry = catMap.get(t.categoryId) ?? { count: 0, active: 0, confidences: [] };
    entry.count += 1;
    if (t.status === "active") entry.active += 1;
    if (t.confidence != null) entry.confidences.push(t.confidence);
    catMap.set(t.categoryId, entry);
  }

  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([categoryId, data]) => ({
      categoryId,
      count: data.count,
      activePct: data.count > 0 ? Math.round((data.active / data.count) * 10000) / 100 : 0,
      avgConfidence:
        data.confidences.length > 0
          ? Math.round(
              (data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length) * 100
            ) / 100
          : null,
    }));

  // By origin
  const originMap = new Map<string, number>();
  for (const t of tags) {
    const key = t.origin ?? "unknown";
    originMap.set(key, (originMap.get(key) ?? 0) + 1);
  }
  const byOrigin = Array.from(originMap.entries())
    .map(([origin, count]) => ({ origin, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalTags: tags.length,
    activeTagCount: activeCount,
    resolvedTagCount: resolvedCount,
    topCategories,
    byOrigin,
  };
}
