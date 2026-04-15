// lib/analytics/aiUsageQuality.ts — Sprint 7
// AI usage quality analytics using Sprint 4 AIInteraction data.
// Internal API only.

import { prisma } from "@/lib/db";

export interface AiUsageQualityReport {
  totalInteractions: number;
  totalTokensUsed: number;
  estimatedCostUSD: number | null;
  avgTokensPerInteraction: number | null;
  avgCostPerInteraction: number | null;
  fallbackRatePct: number;
  byFeature: Array<{
    feature: string;
    count: number;
    pct: number;
    totalTokens: number;
    avgTokens: number | null;
  }>;
  byModel: Array<{
    model: string;
    count: number;
    totalTokens: number;
  }>;
}

export interface AiUsageQualityOptions {
  since?: Date;
}

export async function getAiUsageQuality(
  options: AiUsageQualityOptions = {}
): Promise<AiUsageQualityReport> {
  const { since } = options;

  const interactions = await prisma.aIInteraction.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      feature: true,
      model: true,
      tokensUsed: true,
      estimatedCostUSD: true,
      hadFallback: true,
    },
  });

  if (interactions.length === 0) {
    return {
      totalInteractions: 0,
      totalTokensUsed: 0,
      estimatedCostUSD: null,
      avgTokensPerInteraction: null,
      avgCostPerInteraction: null,
      fallbackRatePct: 0,
      byFeature: [],
      byModel: [],
    };
  }

  const total = interactions.length;
  const totalTokens = interactions.reduce((acc, i) => acc + (i.tokensUsed ?? 0), 0);
  const costSamples = interactions.filter((i) => i.estimatedCostUSD != null);
  const totalCost =
    costSamples.length > 0
      ? costSamples.reduce((acc, i) => acc + (i.estimatedCostUSD ?? 0), 0)
      : null;
  const fallbacks = interactions.filter((i) => i.hadFallback).length;

  // By feature
  const featureMap = new Map<string, { count: number; tokens: number }>();
  for (const i of interactions) {
    const key = i.feature ?? "unknown";
    const entry = featureMap.get(key) ?? { count: 0, tokens: 0 };
    entry.count += 1;
    entry.tokens += i.tokensUsed ?? 0;
    featureMap.set(key, entry);
  }
  const byFeature = Array.from(featureMap.entries())
    .map(([feature, data]) => ({
      feature,
      count: data.count,
      pct: Math.round((data.count / total) * 10000) / 100,
      totalTokens: data.tokens,
      avgTokens: data.count > 0 ? Math.round(data.tokens / data.count) : null,
    }))
    .sort((a, b) => b.count - a.count);

  // By model
  const modelMap = new Map<string, { count: number; tokens: number }>();
  for (const i of interactions) {
    const key = i.model ?? "unknown";
    const entry = modelMap.get(key) ?? { count: 0, tokens: 0 };
    entry.count += 1;
    entry.tokens += i.tokensUsed ?? 0;
    modelMap.set(key, entry);
  }
  const byModel = Array.from(modelMap.entries())
    .map(([model, data]) => ({ model, count: data.count, totalTokens: data.tokens }))
    .sort((a, b) => b.count - a.count);

  return {
    totalInteractions: total,
    totalTokensUsed: totalTokens,
    estimatedCostUSD: totalCost != null ? Math.round(totalCost * 100) / 100 : null,
    avgTokensPerInteraction: total > 0 ? Math.round(totalTokens / total) : null,
    avgCostPerInteraction:
      totalCost != null && total > 0
        ? Math.round((totalCost / total) * 10000) / 10000
        : null,
    fallbackRatePct: Math.round((fallbacks / total) * 10000) / 100,
    byFeature,
    byModel,
  };
}
