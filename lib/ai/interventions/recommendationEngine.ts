import OpenAI from "openai";
import { z } from "zod";
import type { ImpactSnapshot } from "@prisma/client";
import type { SchoolDashboardMetrics } from "@/lib/reporting/dashboard/dashboardAggregator";
import type { TrendSeries } from "@/lib/reporting/trends/types";

export type RecommendationResult = {
  interventionPriorityScore: number;
  growthRiskFlag: "none" | "low" | "medium" | "high" | "critical";
  recommendedActions: Array<{
    type: "curriculum" | "pacing" | "support" | "training" | "resource";
    description: string;
    targetStrandKeys: string[];
    urgency: "low" | "medium" | "high";
  }>;
  dataConfidence: "low" | "medium" | "high";
  generatedAt: string;
};

const riskWeight = {
  none: 0,
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1,
} as const;

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function consecutiveDeclines(values: Array<number | null>): number {
  const cleaned = values.filter((v): v is number => typeof v === "number");
  let count = 0;
  for (let i = cleaned.length - 1; i >= 1; i--) {
    if (cleaned[i] < cleaned[i - 1]) count += 1;
    else break;
  }
  return count;
}

function baseConfidence(impactData?: ImpactSnapshot | null): "low" | "medium" | "high" {
  if (!impactData) return "medium";
  if (!impactData.statisticallyMeaningful && impactData.confidenceLabel === "low") return "low";
  if (impactData.confidenceLabel === "high") return "high";
  return "medium";
}

function normalizeScore(value: number): number {
  return clamp(Math.round(value * 100) / 100, 0, 100);
}

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function defaultActions(): RecommendationResult["recommendedActions"] {
  return [];
}

export function buildInterventionPrompt(params: {
  currentMetrics: SchoolDashboardMetrics;
  trends: TrendSeries;
  impactData?: ImpactSnapshot | null;
  gradeBand?: string;
}): string {
  const { currentMetrics, trends, impactData, gradeBand } = params;
  const promptPayload = {
    currentMetrics,
    trends,
    impactSummary: impactData
      ? {
          statisticallyMeaningful: impactData.statisticallyMeaningful,
          confidenceLabel: impactData.confidenceLabel,
          avgMasteryScore: impactData.avgMasteryScore,
          masteryDelta: impactData.masteryDelta,
          growthDelta: impactData.growthDelta,
          sampleSize: impactData.sampleSize,
        }
      : null,
    gradeBand: gradeBand ?? null,
  };

  return [
    "You are an advisory-only intervention assistant for a national K-12 platform.",
    "Return ONLY valid JSON. No markdown, no explanations.",
    "Do not include any student, teacher, or school identifiers.",
    "Suggest additional recommendedActions only when justified by the metrics.",
    "JSON schema:",
    "{",
    "  \"recommendedActions\": [",
    "    {",
    "      \"type\": \"curriculum|pacing|support|training|resource\",",
    "      \"description\": \"string\",",
    "      \"targetStrandKeys\": [\"string\"],",
    "      \"urgency\": \"low|medium|high\"",
    "    }",
    "  ]",
    "}",
    "Metrics:",
    JSON.stringify(promptPayload),
  ].join("\n");
}

const AiResponseSchema = z.object({
  recommendedActions: z
    .array(
      z.object({
        type: z.enum(["curriculum", "pacing", "support", "training", "resource"]),
        description: z.string().min(1),
        targetStrandKeys: z.array(z.string()),
        urgency: z.enum(["low", "medium", "high"]),
      })
    )
    .optional(),
});

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function tryAiEnhancement(params: {
  currentMetrics: SchoolDashboardMetrics;
  trends: TrendSeries;
  impactData?: ImpactSnapshot | null;
  gradeBand?: string;
}): Promise<RecommendationResult["recommendedActions"] | null> {
  if (process.env.AI_INTERVENTIONS_AI_ENHANCED !== "true") return null;

  const openai = getOpenAIClient();
  if (!openai) return null;

  const prompt = buildInterventionPrompt(params);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const validated = AiResponseSchema.safeParse(parsed);
  if (!validated.success) return null;

  return validated.data.recommendedActions ?? null;
}

function mergeActions(
  base: RecommendationResult["recommendedActions"],
  ai: RecommendationResult["recommendedActions"] | null
): RecommendationResult["recommendedActions"] {
  if (!ai || ai.length === 0) return base;
  const dedup = new Map<string, RecommendationResult["recommendedActions"][0]>();
  for (const action of [...base, ...ai]) {
    const key = `${action.type}:${action.description}`;
    if (!dedup.has(key)) dedup.set(key, action);
  }
  return Array.from(dedup.values());
}

export async function computeRecommendations(params: {
  tenantId: string;
  schoolId: string;
  currentMetrics: SchoolDashboardMetrics;
  trends: TrendSeries;
  impactData?: ImpactSnapshot | null;
  gradeBand?: string;
}): Promise<RecommendationResult> {
  const { currentMetrics, trends, impactData } = params;
  const avgMasteryScore = normalizeRate(currentMetrics.avgMasteryScore);
  const trainingAdoptionRate = normalizeRate(currentMetrics.trainingAdoptionRate);
  const evidenceSubmissionRate = normalizeRate(currentMetrics.evidenceSubmissionRate);

  const masteryDeclines = consecutiveDeclines(trends.masteryTrend.map((b) => b.value));
  const evidenceDeclines = consecutiveDeclines(trends.evidenceVelocityTrend.map((b) => b.value));

  let growthRiskFlag: RecommendationResult["growthRiskFlag"] = "none";
  if (avgMasteryScore < 0.4) growthRiskFlag = "critical";
  else if (masteryDeclines >= 3) growthRiskFlag = "high";
  else if (masteryDeclines >= 2) growthRiskFlag = "medium";
  else if (avgMasteryScore < 0.6) growthRiskFlag = "low";

  const actions = defaultActions();

  if (evidenceDeclines >= 1) {
    actions.push({
      type: "curriculum",
      description: "Reinforce evidence-aligned lesson pacing with targeted practice sets.",
      targetStrandKeys: [],
      urgency: evidenceDeclines >= 2 ? "high" : "medium",
    });
  }

  if (trainingAdoptionRate < 0.3) {
    actions.push({
      type: "training",
      description: "Boost teacher training completion with focused support and coaching sessions.",
      targetStrandKeys: [],
      urgency: "high",
    });
  }

  if (growthRiskFlag === "high" || growthRiskFlag === "critical") {
    actions.push({
      type: "support",
      description: "Deploy additional academic support and targeted remediation blocks.",
      targetStrandKeys: [],
      urgency: "high",
    });
  }

  const score =
    (1 - avgMasteryScore) * 40 +
    riskWeight[growthRiskFlag] * 30 +
    (1 - trainingAdoptionRate) * 20 +
    (1 - evidenceSubmissionRate) * 10;

  const baseResult: RecommendationResult = {
    interventionPriorityScore: normalizeScore(score),
    growthRiskFlag,
    recommendedActions: actions,
    dataConfidence: baseConfidence(impactData),
    generatedAt: new Date().toISOString(),
  };

  try {
    const aiActions = await tryAiEnhancement({
      currentMetrics,
      trends,
      impactData,
      gradeBand: params.gradeBand,
    });
    return {
      ...baseResult,
      recommendedActions: mergeActions(baseResult.recommendedActions, aiActions),
    };
  } catch {
    return baseResult;
  }
}
