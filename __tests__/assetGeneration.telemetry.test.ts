import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLogAIInteraction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/interactionLog", () => ({
  logAIInteraction: mockLogAIInteraction,
}));

import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

describe("asset generation telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAIInteraction.mockResolvedValue({ id: "ai-1" });
  });

  it("records provider, asset, queue, timing, and failure metadata without raw secrets", async () => {
    await logAssetGenerationTelemetry({
      provider: "higgsfield",
      model: "video-model",
      assetType: "certification_video",
      tenantId: "school-1",
      schoolId: "school-1",
      userId: "user-1",
      route: "worker.certificationAssets",
      jobName: "GENERATE_CERTIFICATION_ASSETS",
      startTime: new Date("2026-05-07T10:00:00.000Z"),
      endTime: new Date("2026-05-07T10:00:01.250Z"),
      queueWaitMs: 500,
      retryCount: 2,
      success: false,
      failureReason: "Bearer secret-token provider failed",
      tokensUsed: 0,
      estimatedCostUSD: 0,
    });

    expect(mockLogAIInteraction).toHaveBeenCalledWith(expect.objectContaining({
      route: "worker.certificationAssets",
      provider: "higgsfield",
      model: "video-model",
      latencyMs: 1250,
      metadata: expect.objectContaining({
        assetType: "certification_video",
        queueWaitMs: 500,
        retryCount: 2,
        success: false,
        failureReason: "Bearer [redacted] provider failed",
      }),
    }));
  });
});
