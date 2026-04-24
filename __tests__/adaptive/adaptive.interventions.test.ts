import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    interventionChain: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: vi.fn().mockResolvedValue(undefined),
}));

import { autoTriggerIntervention } from "@/lib/interventions/interventionChains";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autoTriggerIntervention", () => {
  it("creates a new intervention chain when none exists", async () => {
    mockPrisma.interventionChain.findFirst.mockResolvedValueOnce(null);
    mockPrisma.interventionChain.create.mockResolvedValueOnce({ id: "chain1" });

    const result = await autoTriggerIntervention({
      studentId: "student1",
      schoolId: "school1",
      subject: "MATH",
      triggerType: "persistent_low_score",
      masteryPercent: 45,
    });

    expect(result.created).toBe(true);
    expect(result.chainId).toBe("chain1");
    expect(mockPrisma.interventionChain.create).toHaveBeenCalledOnce();
    const createCall = mockPrisma.interventionChain.create.mock.calls[0][0];
    expect(createCall.data.attributionSource).toBe("adaptive.auto.persistent_low_score");
    expect(createCall.data.studentId).toBe("student1");
  });

  it("skips creation when open chain already exists for same source", async () => {
    mockPrisma.interventionChain.findFirst.mockResolvedValueOnce({ id: "existingChain" });

    const result = await autoTriggerIntervention({
      studentId: "student1",
      schoolId: "school1",
      subject: "SCIENCE",
      triggerType: "critical_mastery",
      masteryPercent: 30,
    });

    expect(result.created).toBe(false);
    expect(result.chainId).toBe("existingChain");
    expect(mockPrisma.interventionChain.create).not.toHaveBeenCalled();
  });

  it("uses correct source key per trigger type", async () => {
    mockPrisma.interventionChain.findFirst.mockResolvedValueOnce(null);
    mockPrisma.interventionChain.create.mockResolvedValueOnce({ id: "chain2" });

    await autoTriggerIntervention({
      studentId: "student1",
      schoolId: "school1",
      subject: "CIVICS",
      triggerType: "stale_incomplete",
      masteryPercent: 0,
    });

    const findCall = mockPrisma.interventionChain.findFirst.mock.calls[0][0];
    expect(findCall.where.attributionSource).toBe("adaptive.auto.stale_incomplete");
  });

  it("includes rationale in created chain metadata", async () => {
    mockPrisma.interventionChain.findFirst.mockResolvedValueOnce(null);
    mockPrisma.interventionChain.create.mockResolvedValueOnce({ id: "chain3" });

    await autoTriggerIntervention({
      studentId: "student1",
      schoolId: "school1",
      subject: "LITERACY",
      triggerType: "critical_mastery",
      masteryPercent: 28,
    });

    const createCall = mockPrisma.interventionChain.create.mock.calls[0][0];
    expect(createCall.data.rationale).toContain("28%");
    expect(createCall.data.rationale).toContain("LITERACY");
    expect(createCall.data.rationale).toContain("critical mastery");
  });
});
