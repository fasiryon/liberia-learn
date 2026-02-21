import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    metricEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { aggregateMetrics, recordMetricEvent } from "@/lib/metrics/events";

describe("ops metrics foundations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recordMetricEvent writes rows with pilotOnly=true default", async () => {
    prismaMock.metricEvent.create.mockResolvedValue({ id: "metric-1" });
    await recordMetricEvent(
      "sync.attempt",
      { count: 2 },
      { scope: "school", scopeId: "school-1", schoolId: "school-1" }
    );

    expect(prismaMock.metricEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "sync.attempt",
          pilotOnly: true,
        }),
      })
    );
  });

  it("aggregateMetrics returns correct totals for scope", async () => {
    prismaMock.metricEvent.findMany.mockResolvedValue([
      { name: "sync.attempt", severity: "info", payloadJson: { count: 1 }, createdAt: new Date("2026-02-20T10:00:00.000Z") },
      { name: "sync.failure", severity: "error", payloadJson: {}, createdAt: new Date("2026-02-20T10:01:00.000Z") },
      { name: "sync.result", severity: "warning", payloadJson: { conflicts: 1, processed: 4 }, createdAt: new Date("2026-02-20T10:02:00.000Z") },
      { name: "sms.sent", severity: "info", payloadJson: {}, createdAt: new Date("2026-02-20T10:03:00.000Z") },
      { name: "sms.failed", severity: "error", payloadJson: {}, createdAt: new Date("2026-02-20T10:04:00.000Z") },
      { name: "sms.retry", severity: "warning", payloadJson: {}, createdAt: new Date("2026-02-20T10:05:00.000Z") },
      { name: "sms.blocked.opted_out", severity: "warning", payloadJson: {}, createdAt: new Date("2026-02-20T10:06:00.000Z") },
      { name: "export.generated", severity: "info", payloadJson: { exportType: "training_summary" }, createdAt: new Date("2026-02-20T10:07:00.000Z") },
      { name: "offline.queue.pending", severity: "info", payloadJson: { count: 3 }, createdAt: new Date("2026-02-20T10:08:00.000Z") },
      { name: "offline.queue.conflicts", severity: "info", payloadJson: { count: 2 }, createdAt: new Date("2026-02-20T10:09:00.000Z") },
      { name: "offline.queue.dead_letter", severity: "info", payloadJson: { count: 1 }, createdAt: new Date("2026-02-20T10:10:00.000Z") },
    ]);

    const result = await aggregateMetrics({ scope: "school", scopeId: "school-1", range: "7d" });

    expect(result.sync.syncAttempts).toBe(1);
    expect(result.sync.syncFailures).toBe(1);
    expect(result.sync.conflictRate).toBe(0.25);
    expect(result.sms.sendCount).toBe(1);
    expect(result.sms.retryCount).toBe(1);
    expect(result.sms.optedOutBlockedCount).toBe(1);
    expect(result.exports.exportCount).toBe(1);
    expect(result.offline.pending).toBe(3);
    expect(result.offline.conflicts).toBe(2);
    expect(result.offline.deadLetter).toBe(1);
    expect(prismaMock.metricEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pilotOnly: true }),
      })
    );
  });
});

