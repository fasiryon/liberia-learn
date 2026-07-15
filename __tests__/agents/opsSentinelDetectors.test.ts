import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    agentInvocation: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const getErrorRates24h = vi.fn();
vi.mock("@/lib/ops/errorRates", () => ({ getErrorRates24h: (...a: unknown[]) => getErrorRates24h(...a) }));

const getCronHeartbeatStatus = vi.fn();
vi.mock("@/lib/ops/cronHeartbeat", () => ({
  getCronHeartbeatStatus: (...a: unknown[]) => getCronHeartbeatStatus(...a),
}));

import {
  detectCronMisses,
  detectMigrationDrift,
  detectErrorSpike,
  detectCostCapBreaches,
  runAllDetectors,
} from "@/lib/agents/opsSentinel/detectors";

describe("ops sentinel detectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectCronMisses", () => {
    it("reports not detected when no crons missed", async () => {
      getCronHeartbeatStatus.mockResolvedValue([{ name: "agents-tick", missed: false }]);
      const result = await detectCronMisses();
      expect(result.detected).toBe(false);
    });

    it("is MEDIUM when exactly one cron missed", async () => {
      getCronHeartbeatStatus.mockResolvedValue([
        { name: "agents-tick", missed: true },
        { name: "check-dlq", missed: false },
      ]);
      const result = await detectCronMisses();
      expect(result.detected).toBe(true);
      expect(result.severity).toBe("MEDIUM");
    });

    it("is HIGH when more than one cron missed", async () => {
      getCronHeartbeatStatus.mockResolvedValue([
        { name: "agents-tick", missed: true },
        { name: "check-dlq", missed: true },
      ]);
      const result = await detectCronMisses();
      expect(result.severity).toBe("HIGH");
    });
  });

  describe("detectMigrationDrift", () => {
    it("reports no drift when no pending migrations", async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ pending: 0n }]);
      const result = await detectMigrationDrift();
      expect(result.detected).toBe(false);
      expect(result.severity).toBe("HIGH");
    });

    it("detects pending migrations", async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ pending: 2n }]);
      const result = await detectMigrationDrift();
      expect(result.detected).toBe(true);
      expect(result.details).toEqual({ pending: 2 });
    });

    it("fails closed (detects) when the migrations query errors", async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error("connection lost"));
      const result = await detectMigrationDrift();
      expect(result.detected).toBe(true);
      expect(result.severity).toBe("HIGH");
    });
  });

  describe("detectErrorSpike", () => {
    it("is not detected below the threshold", async () => {
      getErrorRates24h.mockResolvedValue({ totalErrors24h: 10, topKinds: [] });
      const result = await detectErrorSpike();
      expect(result.detected).toBe(false);
      expect(result.severity).toBe("MEDIUM");
    });

    it("is MEDIUM at threshold and HIGH at 2x threshold", async () => {
      getErrorRates24h.mockResolvedValue({ totalErrors24h: 50, topKinds: [] });
      expect((await detectErrorSpike()).severity).toBe("MEDIUM");

      getErrorRates24h.mockResolvedValue({ totalErrors24h: 100, topKinds: [] });
      expect((await detectErrorSpike()).severity).toBe("HIGH");
    });
  });

  describe("detectCostCapBreaches", () => {
    it("is not detected below the threshold", async () => {
      prismaMock.agentInvocation.count.mockResolvedValue(1);
      const result = await detectCostCapBreaches();
      expect(result.detected).toBe(false);
    });

    it("queries only COST_CAPPED invocations in the last 24h", async () => {
      const now = new Date("2026-07-15T12:00:00.000Z");
      prismaMock.agentInvocation.count.mockResolvedValue(5);
      await detectCostCapBreaches(now);

      expect(prismaMock.agentInvocation.count).toHaveBeenCalledWith({
        where: {
          status: "COST_CAPPED",
          createdAt: { gte: new Date("2026-07-14T12:00:00.000Z") },
        },
      });
    });
  });

  describe("runAllDetectors", () => {
    it("runs all four detectors", async () => {
      getCronHeartbeatStatus.mockResolvedValue([]);
      prismaMock.$queryRaw.mockResolvedValue([{ pending: 0n }]);
      getErrorRates24h.mockResolvedValue({ totalErrors24h: 0, topKinds: [] });
      prismaMock.agentInvocation.count.mockResolvedValue(0);

      const results = await runAllDetectors();
      expect(results.map((r) => r.category)).toEqual([
        "cron_miss",
        "migration_drift",
        "error_spike",
        "cost_cap_breach",
      ]);
    });
  });
});
