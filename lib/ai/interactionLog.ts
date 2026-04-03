import { prisma } from "@/lib/db";

export type AiBudgetFeature =
  | "tutor"
  | "teacherAssist"
  | "grading"
  | "curriculum";

type AiUsageInput = {
  estimatedCostUSD?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
};

export type RecordAiUsageInput = {
  route: string;
  feature: AiBudgetFeature;
  schoolId?: string | null;
  userId?: string | null;
  subject?: string | null;
  strandKey?: string | null;
  requestType?: string | null;
  guidanceLevel?: string | null;
  tokensUsed?: number | null;
  estimatedCostUSD?: number | null;
  model?: string | null;
  tier?: string | null;
  fallbackUsed?: boolean | null;
};

export function getAiUsageMetrics(input: AiUsageInput) {
  const inputTokens =
    typeof input.inputTokens === "number" && Number.isFinite(input.inputTokens)
      ? Math.max(0, input.inputTokens)
      : 0;
  const outputTokens =
    typeof input.outputTokens === "number" && Number.isFinite(input.outputTokens)
      ? Math.max(0, input.outputTokens)
      : 0;
  const estimatedCostUSD =
    typeof input.estimatedCostUSD === "number" && Number.isFinite(input.estimatedCostUSD)
      ? Math.max(0, input.estimatedCostUSD)
      : 0;

  return {
    tokensUsed: inputTokens + outputTokens,
    estimatedCostUSD,
    model: input.model ?? null,
  };
}

export function normalizeAiFeature(feature: string | null | undefined): AiBudgetFeature {
  switch (feature) {
    case "tutor":
    case "teacherAssist":
    case "grading":
    case "curriculum":
      return feature;
    default:
      return "curriculum";
  }
}

export async function recordAiUsage(input: RecordAiUsageInput) {
  const aiInteractionLogModel = (prisma as typeof prisma & {
    aiInteractionLog?: { create?: (args: unknown) => Promise<unknown> };
  }).aiInteractionLog;

  if (!aiInteractionLogModel?.create) {
    return null;
  }

  const tokensUsed =
    typeof input.tokensUsed === "number" && Number.isFinite(input.tokensUsed)
      ? Math.max(0, Math.round(input.tokensUsed))
      : 0;
  const estimatedCostUSD =
    typeof input.estimatedCostUSD === "number" && Number.isFinite(input.estimatedCostUSD)
      ? Math.max(0, input.estimatedCostUSD)
      : 0;

  return aiInteractionLogModel
    .create({
      data: {
        schoolId: input.schoolId ?? null,
        userId: input.userId ?? null,
        feature: normalizeAiFeature(input.feature),
        subject: input.subject?.trim() || "general",
        strandKey: input.strandKey?.trim() || "general",
        requestType: input.requestType?.trim() || input.feature,
        endpoint: input.route,
        guidanceLevel: input.guidanceLevel ?? null,
        model: input.model ?? null,
        tier: input.tier ?? null,
        hadFallback: input.fallbackUsed === true,
        tokensUsed,
        estimatedCostUSD,
      },
    })
    .catch(() => null);
}
