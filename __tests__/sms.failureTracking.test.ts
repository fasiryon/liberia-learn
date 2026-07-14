import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRecordMetricEvent, mockEnqueueEscalation } = vi.hoisted(() => ({
  mockPrisma: { metricEvent: { findMany: vi.fn() } },
  mockRecordMetricEvent: vi.fn(),
  mockEnqueueEscalation: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: mockRecordMetricEvent }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import { recordSmsSendFailure } from "@/lib/sms/failureTracking";

function failureEvents(count: number, provider: string) {
  return Array.from({ length: count }, () => ({ payloadJson: { provider } }));
}

describe("recordSmsSendFailure", () => {
  beforeEach(() => {
    mockPrisma.metricEvent.findMany.mockReset();
    mockRecordMetricEvent.mockReset();
    mockEnqueueEscalation.mockReset();
    mockRecordMetricEvent.mockResolvedValue(undefined);
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  });

  it("always records a metric event with the provider name (alert half of alert-and-stop)", async () => {
    mockPrisma.metricEvent.findMany.mockResolvedValue([]);

    await recordSmsSendFailure("orange", { scope: "national", scopeId: null }, { error: "HTTP 503" });

    expect(mockRecordMetricEvent).toHaveBeenCalledWith(
      "sms.failed",
      expect.objectContaining({ provider: "orange", error: "HTTP 503" }),
      expect.objectContaining({ severity: "error", kind: "counter" })
    );
  });

  it("does not escalate below the 3-failure threshold", async () => {
    mockPrisma.metricEvent.findMany.mockResolvedValue(failureEvents(2, "orange"));

    await recordSmsSendFailure("orange", { scope: "national", scopeId: null });

    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("escalates at MEDIUM priority exactly when the count crosses 3", async () => {
    mockPrisma.metricEvent.findMany.mockResolvedValue(failureEvents(3, "orange"));

    await recordSmsSendFailure("orange", { scope: "national", scopeId: null });

    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "MEDIUM", invocationId: null })
    );
    expect(mockEnqueueEscalation.mock.calls[0][0].reason).toContain("orange");
  });

  it("does not re-escalate on the 4th, 5th, etc. failure in the same cluster", async () => {
    mockPrisma.metricEvent.findMany.mockResolvedValue(failureEvents(4, "orange"));
    await recordSmsSendFailure("orange", { scope: "national", scopeId: null });
    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("only counts failures for the same provider (per-provider clustering)", async () => {
    // 2 orange + 5 twilio failures in the window - orange hasn't crossed 3.
    mockPrisma.metricEvent.findMany.mockResolvedValue([...failureEvents(2, "orange"), ...failureEvents(5, "twilio")]);

    await recordSmsSendFailure("orange", { scope: "national", scopeId: null });

    expect(mockEnqueueEscalation).not.toHaveBeenCalled();
  });

  it("queries only the last 60 minutes for clustering", async () => {
    mockPrisma.metricEvent.findMany.mockResolvedValue([]);
    const before = Date.now();

    await recordSmsSendFailure("orange", { scope: "national", scopeId: null });

    const call = mockPrisma.metricEvent.findMany.mock.calls[0][0];
    const gte: Date = call.where.createdAt.gte;
    expect(before - gte.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(before - gte.getTime()).toBeLessThanOrEqual(60 * 60 * 1000 + 5000);
    expect(call.where.name).toBe("sms.failed");
  });
});
