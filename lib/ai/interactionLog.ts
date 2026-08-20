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
  generationCorrelationId?: string | null;
  contentVersion?: string | null;
  assessmentVersion?: string | null;
  calculationVersion?: string | null;
  clientEventId?: string | null;
  originalTimestamp?: Date | string | null;
  syncReceivedAt?: Date | string | null;
  dedupeKey?: string | null;
  sourceEventId?: string | null;
  metadata?: JsonObject | null;
  durable?: boolean;
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
    aIInteraction?: {
      create?: (args: unknown) => Promise<{ id: string }>;
      findFirst?: (args: unknown) => Promise<{ id: string } | null>;
    };
  }).aIInteraction;

  if (!aiInteractionLogModel?.create && !aiInteractionModel?.create) {
    if (input.durable) throw new Error("AIInteraction persistence is unavailable");
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

  // One external provider invocation must produce at most one canonical
  // AIInteraction row, enforced by the database, not a per-process check --
  // the field must behave identically whether the two writes for the same
  // invocation land in the same Node process (routedCompletion's own
  // internal write racing a caller's own defensive durable write) or in two
  // entirely different serverless instances/workers.
  //
  // dedupeKey (AIInteraction.dedupeKey) already carries a UNIQUE index
  // (prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique)
  // and is reused here rather than introducing a third identifier: it was
  // already the caller-supplied idempotency key for offline-sync dedup on
  // this exact table (see groundedAnswerService.ts), so a provider
  // invocation's dedupeKey defaults to its generationCorrelationId only
  // when the caller hasn't already supplied its own dedupeKey for that
  // other purpose. Standard Postgres NULL semantics mean any number of NULL
  // dedupeKey rows (every call that mints neither) are unaffected by the
  // constraint.
  //
  // Idempotent insert: try to create; if the database reports a unique
  // violation on dedupeKey, another writer already won -- fetch and reuse
  // that row instead of inserting a second one. This is atomic at the
  // Postgres engine level (a real conflicting INSERT is guaranteed to fail
  // with a real error, not a race window), so it is correct across any
  // number of concurrent processes, not just within one.
  //
  // A repeated *persistence attempt* for the same invocation (same
  // dedupeKey) coalesces to one row. A genuine *new* provider call always
  // gets its own correlation id from routedCompletion, so distinct real
  // calls -- even with byte-identical prompt/model/evidence -- are never
  // coalesced; nothing here dedupes on content.
  function isDedupeKeyUniqueViolation(error: unknown): boolean {
    const err = error as { code?: string; meta?: { target?: unknown } } | null;
    if (!err || err.code !== "P2002") return false;
    const target = err.meta?.target;
    if (typeof target === "string") return target.includes("dedupeKey");
    if (Array.isArray(target)) return target.includes("dedupeKey");
    return true; // conservative: treat any P2002 on this insert as the dedupeKey constraint
  }

  async function createInteractionRow(
    correlationId: string | null,
    dedupeKey: string | null
  ): Promise<{ id: string; isNew: boolean }> {
    const created = await aiInteractionModel!.create!({
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
        generationCorrelationId: correlationId,
        clientEventId: input.clientEventId ?? null,
        originalOccurredAt: toDate(input.originalTimestamp),
        syncReceivedAt: toDate(input.syncReceivedAt),
        dedupeKey,
        sourceEventId: input.sourceEventId ?? null,
        metadata: toJson(metadata),
        legacyLogRequired: Boolean(aiInteractionLogModel?.create),
      },
    });
    return { id: created.id, isNew: true };
  }

  async function resolveInteractionRow(): Promise<{ id: string; isNew: boolean } | null> {
    if (!aiInteractionModel?.create) return null;
    const correlationId = input.generationCorrelationId?.trim() || null;
    const dedupeKey = input.dedupeKey?.trim() || correlationId;

    if (!dedupeKey) {
      // No idempotency key available for this call at all (e.g. a
      // non-curriculum feature with no correlation id and no caller-supplied
      // dedupeKey) -- nothing to enforce against, always a fresh row.
      return createInteractionRow(correlationId, null);
    }

    try {
      return await createInteractionRow(correlationId, dedupeKey);
    } catch (error) {
      if (!isDedupeKeyUniqueViolation(error) || !aiInteractionModel.findFirst) throw error;
      const existing = await aiInteractionModel.findFirst({ where: { dedupeKey } });
      if (existing) return { id: existing.id, isNew: false };
      throw error;
    }
  }

  const interactionWrite = aiInteractionModel?.create
    ? resolveInteractionRow()
    : Promise.reject(new Error("AIInteraction persistence is unavailable"));

  // Never let a rejection from interactionWrite propagate into the legacy-log
  // branch below (which only needs to know isNew, not whether the caller's
  // own durable-mode await should see a failure).
  const interactionOutcome = interactionWrite.then(
    (row) => ({ ok: true as const, row }),
    () => ({ ok: false as const, row: null })
  );

  const [legacyLog] = await Promise.all([
    aiInteractionLogModel?.create
      ? interactionOutcome.then((outcome) =>
          outcome.ok && outcome.row
            ? aiInteractionLogModel
                .create({
                  data: {
                    aiInteractionId: outcome.row.id,
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
            : null
        )
      : Promise.resolve(null),
    input.durable ? interactionWrite : interactionWrite.catch(() => null),
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
      dedupeKey: input.dedupeKey ?? input.generationCorrelationId ?? null,
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

/**
 * Repairs the bounded legacy analytics projection from canonical
 * AIInteraction rows. The canonical row is the billing/source-of-truth
 * record; a unique AiInteractionLog.aiInteractionId prevents a retry or two
 * reconcilers from double-counting the projection.
 */
export async function reconcileMissingAiInteractionLogs(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(500, options.limit ?? 100));
  const rows = await prisma.aIInteraction.findMany({
    where: { legacyLogRequired: true, legacyLog: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      schoolId: true,
      userId: true,
      feature: true,
      subject: true,
      strandKey: true,
      requestType: true,
      route: true,
      guidanceLevel: true,
      model: true,
      tier: true,
      hadFallback: true,
      tokensUsed: true,
      estimatedCostUSD: true,
      createdAt: true,
    },
  });
  let repaired = 0;
  let alreadyRepaired = 0;
  const failed: Array<{ aiInteractionId: string; error: string }> = [];
  for (const row of rows) {
    try {
      await prisma.aiInteractionLog.create({
        data: {
          aiInteractionId: row.id,
          schoolId: row.schoolId,
          userId: row.userId,
          feature: row.feature,
          subject: row.subject?.trim() || "general",
          strandKey: row.strandKey?.trim() || "general",
          requestType: row.requestType?.trim() || row.feature?.trim() || "curriculum",
          endpoint: row.route,
          guidanceLevel: row.guidanceLevel,
          model: row.model,
          tier: row.tier,
          hadFallback: row.hadFallback,
          tokensUsed: row.tokensUsed,
          estimatedCostUSD: row.estimatedCostUSD,
          timestamp: row.createdAt,
        },
      });
      repaired += 1;
    } catch (error) {
      const candidate = error as { code?: string };
      if (candidate.code === "P2002") {
        alreadyRepaired += 1;
      } else {
        failed.push({
          aiInteractionId: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return { scanned: rows.length, repaired, alreadyRepaired, failed };
}
