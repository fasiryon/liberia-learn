import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

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
  const aiInteractionModel = (prisma as typeof prisma & {
    aIInteraction?: { create?: (args: unknown) => Promise<unknown> };
  }).aIInteraction;

  if (!aiInteractionLogModel?.create && !aiInteractionModel?.create) {
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

  const feature = normalizeAiFeature(input.feature);
  const subject = input.subject?.trim() || "general";
  const strandKey = input.strandKey?.trim() || "general";
  const requestType = input.requestType?.trim() || input.feature;
  const hadFallback = input.fallbackUsed === true;

  const [legacyLog] = await Promise.all([
    aiInteractionLogModel?.create
      ? aiInteractionLogModel
          .create({
            data: {
              schoolId: input.schoolId ?? null,
              userId: input.userId ?? null,
              feature,
              subject,
              strandKey,
              requestType,
              endpoint: input.route,
              guidanceLevel: input.guidanceLevel ?? null,
              model: input.model ?? null,
              tier: input.tier ?? null,
              hadFallback,
              tokensUsed,
              estimatedCostUSD,
            },
          })
          .catch(() => null)
      : Promise.resolve(null),
    aiInteractionModel?.create
      ? aiInteractionModel
          .create({
            data: {
              schoolId: input.schoolId ?? null,
              userId: input.userId ?? null,
              route: input.route,
              feature,
              requestType,
              guidanceLevel: input.guidanceLevel ?? null,
              subject,
              strandKey,
              model: input.model ?? null,
              provider:
                input.model === "budget_guard"
                  ? "budget_guard"
                  : input.model?.startsWith("groq:")
                    ? "groq"
                    : "openai",
              tier: input.tier ?? null,
              hadFallback,
              tokensUsed,
              estimatedCostUSD,
              metadata: {
                normalizedFeature: feature,
              },
            },
          })
          .catch(() => null)
      : Promise.resolve(null),
    logLearningEvent({
      schoolId: input.schoolId ?? null,
      userId: input.userId ?? null,
      actor: {
        type: "user",
        id: input.userId ?? null,
      },
      eventType: "ai.interaction",
      source: input.route,
      subject,
      metadata: {
        feature,
        requestType,
        guidanceLevel: input.guidanceLevel ?? null,
        model: input.model ?? null,
        tier: input.tier ?? null,
        tokensUsed,
        estimatedCostUSD,
      },
      qualityMarkers: {
        hadFallback,
        interactionLog: "aggregate_and_normalized",
      },
    }),
  ]);

  return legacyLog;
}
