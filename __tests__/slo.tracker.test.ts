import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    sloEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { getSloStatus, getSloSummary, recordSloEvent } from "@/lib/slo/tracker";

describe("slo tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records persistent slo events without blocking callers", async () => {
    prismaMock.sloEvent.create.mockResolvedValue({ id: "slo-1" });

    await expect(
      recordSloEvent({ service: "login", success: true, latencyMs: 123, schoolId: "school-1" })
    ).resolves.toEqual({ id: "slo-1" });

    expect(prismaMock.sloEvent.create).toHaveBeenCalledWith({
      data: {
        service: "login",
        success: true,
        latencyMs: 123,
        schoolId: "school-1",
      },
    });
  });

  it("no-ops safely when the sloEvent prisma model is unavailable", async () => {
    const originalModel = prismaMock.sloEvent;
    // Simulates older route tests that only mock the prisma models they use.
    delete (prismaMock as { sloEvent?: unknown }).sloEvent;

    await expect(
      recordSloEvent({ service: "tutor", success: true, latencyMs: 42, schoolId: "school-1" })
    ).resolves.toBeNull();
    await expect(getSloStatus()).resolves.toMatchObject({
      login: { totalEvents: 0, successfulEvents: 0 },
      tutor: { totalEvents: 0, successfulEvents: 0 },
      submit: { totalEvents: 0, successfulEvents: 0 },
      export: { totalEvents: 0, successfulEvents: 0 },
    });

    prismaMock.sloEvent = originalModel;
  });

  it("computes 24h service status and summary", async () => {
    prismaMock.sloEvent.findMany.mockResolvedValue([
      { service: "login", success: true, latencyMs: 100 },
      { service: "login", success: false, latencyMs: 180 },
      { service: "tutor", success: true, latencyMs: 3000 },
      { service: "tutor", success: true, latencyMs: 9100 },
      { service: "submit", success: true, latencyMs: 250 },
      { service: "export", success: false, latencyMs: 1100 },
    ]);

    const status = await getSloStatus();
    const summary = await getSloSummary();

    expect(status.login.current).toBe(0.5);
    expect(status.tutor.current).toBe(1);
    expect(status.tutor.p95LatencyMs).toBe(9100);
    expect(status.aiResponseP95Ms.status).toBe("degraded");
    expect(status.export.status).toBe("critical");
    expect(summary).toEqual({
      login: "critical",
      tutor: "healthy",
      submit: "healthy",
      export: "critical",
    });
  });
});
