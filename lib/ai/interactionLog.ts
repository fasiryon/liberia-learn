import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

export type AiBudgetFeature = "tutor" | "teacherAssist" | "grading" | "curriculum" | "labs";

type JsonObject = Record<string, unknown>;

type AiUsageInput = {
  estimatedCostUSD?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  model?: string | null;
};

export type LogAIInteractionInput = {
  route: string;
  feature: AiBudgetFeature;
  schoolId?: string | null;
  userId?: string | null;
  studentId?: string | null;
  subject?: string | null;
  strandKey?: string | null;
  requestType?: string | null;
  guidanceLevel?: string | null;
  contentId?: string | null;
  lessonId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  tokensUsed?: number | null;
  estimatedCostUSD?: number | null;
  model?: string | null;
  provider?: string | null;
  tier?: string | null;
  fallbackUsed?: boolean | null;
  latencyMs?: number | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  contentVersion?: string | null;
  assessmentVersion?: string | null;
  calculationVersion?: string | null;
  clientEventId?: string | null;
  originalTimestamp?: Date | string | null;
  syncReceivedAt?: Date | string | null;
  dedupeKey?: string | null;
  sourceEventId?: string | null;
  metadata?: JsonObject | null;
};

export type RecordAiUsageInput = LogAIInteractionInput;

function toDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function toJson(value?: JsonObject | null): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

function sanitizeTelemetryMetadata(
  value: JsonObject | null | undefined
): JsonObject | undefined {
  if (!value) {
    return undefined;
  }

  const blockedKeyPattern =
    /(prompt|message|question|answer|response|content|student|name|email|phone|address)/i;

  const sanitize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((entry) => sanitize(entry)).filter((entry) => entry !== undefined);
    }

    if (input && typeof input === "object") {
      const result: JsonObject = {};
      for (const [key, entry] of Object.entries(input as JsonObject)) {
        if (blockedKeyPattern.test(key)) {
          continue;
        }
        const sanitized = sanitize(entry);
        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      }
      return result;
    }

    if (
      typeof input === "string" &&
      input.length > 240 &&
      /\s/.test(input)
    ) {
      return undefined;
    }

    return input;
  };

  const sanitized = sanitize(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as JsonObject)
    : undefined;
}

function inferProvider(model: string | null | undefined, explicitProvider?: string | null) {
  if (explicitProvider?.trim()) {
    return explicitProvider.trim();
  }
  if (model === "budget_guard") {
    return "budget_guard";
  }
  if (model?.startsWith("groq:") || model === "llama-3.1-8b-instant") {
    return "groq";
  }
  return "openai";
}

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

export async function logAIInteraction(input: LogAIInteractionInput) {
  const aiInteractionLogModel = (prisma as typeof prisma & {
    aiInteractionLog?: { create?: (args: unknown) => Promise<unknown> };
  }).aiInteractionLog;
  const aiInteractionModel = (prisma as typeof prisma & {
    aIInteraction?: { create?: (args: unknown) => Promise<unknown> };
  }).aIInteraction;

  if (!aiInteractionLogModel?.create && !aiInteractionModel?.create) {
    return null;
  }

  const metrics = getAiUsageMetrics({
    estimatedCostUSD: input.estimatedCostUSD,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    model: input.model,
  });
  const tokensUsed =
    typeof input.tokensUsed === "number" && Number.isFinite(input.tokensUsed)
      ? Math.max(0, Math.round(input.tokensUsed))
      : metrics.tokensUsed;
  const estimatedCostUSD = metrics.estimatedCostUSD;
  const feature = normalizeAiFeature(input.feature);
  const subject = input.subject?.trim() || "general";
  const strandKey = input.strandKey?.trim() || "general";
  const requestType = input.requestType?.trim() || input.feature;
  const hadFallback = input.fallbackUsed === true;
  const metadata = sanitizeTelemetryMetadata({
    normalizedFeature: feature,
    promptKey: input.promptKey ?? null,
    promptHash: input.promptHash ?? null,
    ...(input.metadata ?? {}),
  });

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
              studentId: input.studentId ?? input.userId ?? null,
              route: input.route,
              feature,
              requestType,
              guidanceLevel: input.guidanceLevel ?? null,
              subject,
              strandKey,
              contentId: input.contentId ?? null,
              lessonId: input.lessonId ?? null,
              model: input.model ?? null,
              provider: inferProvider(input.model, input.provider),
              tier: input.tier ?? null,
              hadFallback,
              tokensUsed,
              estimatedCostUSD,
              latencyMs: input.latencyMs ?? null,
              promptVersion: input.promptVersion ?? null,
              contentVersion: input.contentVersion ?? null,
              assessmentVersion: input.assessmentVersion ?? null,
              calculationVersion: input.calculationVersion ?? null,
              promptKey: input.promptKey ?? null,
              promptHash: input.promptHash ?? null,
              clientEventId: input.clientEventId ?? null,
              originalOccurredAt: toDate(input.originalTimestamp),
              syncReceivedAt: toDate(input.syncReceivedAt),
              dedupeKey: input.dedupeKey ?? null,
              sourceEventId: input.sourceEventId ?? null,
              metadata: toJson(metadata),
            },
          })
          .catch(() => null)
      : Promise.resolve(null),
    logLearningEvent({
      schoolId: input.schoolId ?? null,
      userId: input.userId ?? null,
      studentId: input.studentId ?? input.userId ?? null,
      actor: {
        type: "user",
        id: input.userId ?? null,
      },
      eventType: "ai.interaction",
      source: input.route,
      subject,
      contentId: input.contentId ?? null,
      lessonId: input.lessonId ?? null,
      clientEventId: input.clientEventId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      originalOccurredAt: input.originalTimestamp ?? null,
      syncReceivedAt: input.syncReceivedAt ?? null,
      replayOfEventId: input.sourceEventId ?? null,
      versionRefs: {
        promptVersion: input.promptVersion ?? null,
        assessmentVersion: input.assessmentVersion ?? null,
        calculationVersion: input.calculationVersion ?? null,
      },
      metadata: {
        feature,
        requestType,
        guidanceLevel: input.guidanceLevel ?? null,
        model: input.model ?? null,
        provider: inferProvider(input.model, input.provider),
        tier: input.tier ?? null,
        promptKey: input.promptKey ?? null,
        contentVersion: input.contentVersion ?? null,
      },
      qualityMarkers: {
        hadFallback,
        tokensUsed,
        estimatedCostUSD,
        telemetrySanitized: true,
      },
    }),
  ]);

  return legacyLog;
}

export async function recordAiUsage(input: RecordAiUsageInput) {
  return logAIInteraction(input);
}
