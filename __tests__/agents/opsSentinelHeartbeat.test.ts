import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    metricEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { recordCronHeartbeat, getCronHeartbeatStatus } from "@/lib/ops/cronHeartbeat";

describe("cron heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a heartbeat as a cron.heartbeat metric event", async () => {
    prismaMock.metricEvent.create.mockResolvedValue({ id: "m1" });
    await recordCronHeartbeat("check-dlq");

    expect(prismaMock.metricEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "cron.heartbeat",
          payloadJson: { cronName: "check-dlq" },
        }),
      })
    );
  });

  it("flags a cron as missed when it has never reported a heartbeat", async () => {
    prismaMock.metricEvent.findFirst.mockResolvedValue(null);
    const [status] = await getCronHeartbeatStatus([{ name: "check-dlq", intervalMinutes: 15 }]);

    expect(status.missed).toBe(true);
    expect(status.lastHeartbeatAt).toBeNull();
  });

  it("does not flag a cron whose last heartbeat is within the grace window", async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    prismaMock.metricEvent.findFirst.mockResolvedValue({
      createdAt: new Date("2026-07-15T11:50:00.000Z"), // 10 minutes ago, interval 15 * 2 = 30 grace
    });

    const [status] = await getCronHeartbeatStatus([{ name: "check-dlq", intervalMinutes: 15 }], now);

    expect(status.missed).toBe(false);
    expect(status.minutesSinceLastHeartbeat).toBeCloseTo(10, 5);
  });

  it("flags a cron whose last heartbeat exceeds interval * grace multiplier", async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    prismaMock.metricEvent.findFirst.mockResolvedValue({
      createdAt: new Date("2026-07-15T11:00:00.000Z"), // 60 minutes ago, interval 15 * 2 = 30 grace
    });

    const [status] = await getCronHeartbeatStatus([{ name: "check-dlq", intervalMinutes: 15 }], now);

    expect(status.missed).toBe(true);
  });
});
