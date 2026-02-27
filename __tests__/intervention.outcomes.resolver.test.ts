/**
 * __tests__/intervention.outcomes.resolver.test.ts — Block 17
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resolveInterventionOutcome,
  resolveInterventionOutcomesBatch,
} from "@/lib/metrics/impact/interventionOutcomeResolver";

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockInterventionLogFindMany = vi.fn();

const prisma = {
  studentMasteryProfile: { findMany: mockFindMany },
  interventionLog: { updateMany: mockUpdateMany, findMany: mockInterventionLogFindMany },
};

const LOG = {
  id: "log-1",
  tenantId: "tenant-1",
  schoolId: "school-1",
  generatedAt: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 1 });
});

describe("resolveInterventionOutcome()", () => {
  it("computes outcomeDelta correctly for a known fixture", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ currentScore: 0.4 }, { currentScore: 0.6 }])
      .mockResolvedValueOnce([{ currentScore: 0.7 }, { currentScore: 0.9 }]);

    const result = await resolveInterventionOutcome({
      prisma: prisma as any,
      log: LOG,
      now: new Date("2026-02-01T00:00:00Z"),
    });

    expect(result.outcomeDelta).toBeCloseTo(0.3, 4);
    expect(result.outcomeEffectSize).toBeCloseTo(3.0, 4);

    const [updateCall] = mockUpdateMany.mock.calls;
    expect(updateCall[0].data.outcomeDelta).toBeCloseTo(0.3, 4);
    expect(updateCall[0].data.outcomeEffectSize).toBeCloseTo(3.0, 4);
  });

  it("is idempotent when stored values match computed values", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ currentScore: 0.5 }, { currentScore: 0.7 }])
      .mockResolvedValueOnce([{ currentScore: 0.8 }, { currentScore: 1.0 }]);

    const first = await resolveInterventionOutcome({
      prisma: prisma as any,
      log: LOG,
      now: new Date("2026-02-01T00:00:00Z"),
    });

    expect(first.updated).toBe(true);

    mockUpdateMany.mockClear();
    mockFindMany.mockClear();
    mockFindMany
      .mockResolvedValueOnce([{ currentScore: 0.5 }, { currentScore: 0.7 }])
      .mockResolvedValueOnce([{ currentScore: 0.8 }, { currentScore: 1.0 }]);

    const second = await resolveInterventionOutcome({
      prisma: prisma as any,
      log: {
        ...LOG,
        outcomeCheckedAt: new Date("2026-02-01T00:00:00Z"),
        outcomeDelta: first.outcomeDelta,
        outcomeEffectSize: first.outcomeEffectSize,
        outcomeBaselineStart: first.outcomeBaselineStart,
        outcomeBaselineEnd: first.outcomeBaselineEnd,
        outcomeFollowupStart: first.outcomeFollowupStart,
        outcomeFollowupEnd: first.outcomeFollowupEnd,
        outcomeBaselineCount: first.outcomeBaselineCount,
        outcomeFollowupCount: first.outcomeFollowupCount,
      },
      now: new Date("2026-02-02T00:00:00Z"),
    });

    expect(second.updated).toBe(false);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("updates are scoped by tenantId and schoolId", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ currentScore: 0.4 }, { currentScore: 0.6 }])
      .mockResolvedValueOnce([{ currentScore: 0.5 }, { currentScore: 0.7 }]);

    await resolveInterventionOutcome({
      prisma: prisma as any,
      log: LOG,
      now: new Date("2026-02-01T00:00:00Z"),
    });

    const [updateCall] = mockUpdateMany.mock.calls;
    const where = updateCall[0].where;
    expect(where.id).toBe("log-1");
    expect(where.tenantId).toBe("tenant-1");
    expect(where.schoolId).toBe("school-1");
  });
});

describe("resolveInterventionOutcomesBatch()", () => {
  it("queries only unresolved logs and is safe to re-run", async () => {
    mockInterventionLogFindMany.mockResolvedValue([]);

    const r1 = await resolveInterventionOutcomesBatch({
      prisma: prisma as any,
      now: new Date("2026-02-01T00:00:00Z"),
      minAgeDays: 30,
      batchSize: 50,
    });
    const r2 = await resolveInterventionOutcomesBatch({
      prisma: prisma as any,
      now: new Date("2026-02-02T00:00:00Z"),
      minAgeDays: 30,
      batchSize: 50,
    });

    expect(r1.scanned).toBe(0);
    expect(r2.scanned).toBe(0);

    const [call] = mockInterventionLogFindMany.mock.calls;
    const where = call[0].where;
    expect(where.outcomeCheckedAt).toBe(null);
    expect(where.generatedAt).toHaveProperty("lte");
  });
});

