import { logAIInteraction } from "@/lib/ai/interactionLog";

type AssetGenerationTelemetryInput = {
  provider: string;
  model?: string | null;
  assetType: string;
  tenantId?: string | null;
  schoolId?: string | null;
  userId?: string | null;
  route: string;
  jobName?: string | null;
  startTime: Date;
  endTime: Date;
  queueWaitMs?: number | null;
  retryCount?: number | null;
  success: boolean;
  failureReason?: string | null;
  tokensUsed?: number | null;
  estimatedCostUSD?: number | null;
  metadata?: Record<string, unknown> | null;
};

function safeFailureReason(reason?: string | null) {
  if (!reason) return null;
  return reason.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]").slice(0, 240);
}

export async function logAssetGenerationTelemetry(input: AssetGenerationTelemetryInput) {
  const durationMs = Math.max(0, input.endTime.getTime() - input.startTime.getTime());

  await logAIInteraction({
    route: input.route,
    feature: "curriculum",
    schoolId: input.schoolId ?? input.tenantId ?? null,
    userId: input.userId ?? null,
    requestType: `asset_${input.assetType}`,
    subject: "asset-generation",
    strandKey: input.assetType,
    provider: input.provider,
    model: input.model ?? null,
    tokensUsed: input.tokensUsed ?? 0,
    estimatedCostUSD: input.estimatedCostUSD ?? 0,
    latencyMs: durationMs,
    metadata: {
      provider: input.provider,
      model: input.model ?? null,
      assetType: input.assetType,
      tenantId: input.tenantId ?? null,
      schoolId: input.schoolId ?? null,
      route: input.route,
      jobName: input.jobName ?? null,
      startTime: input.startTime.toISOString(),
      endTime: input.endTime.toISOString(),
      durationMs,
      queueWaitMs: input.queueWaitMs ?? null,
      retryCount: input.retryCount ?? null,
      success: input.success,
      failureReason: safeFailureReason(input.failureReason),
      tokensUsed: input.tokensUsed ?? null,
      estimatedCostUSD: input.estimatedCostUSD ?? null,
      ...(input.metadata ?? {}),
    },
  });
}
