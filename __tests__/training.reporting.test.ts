import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    trainingModule: { findMany: vi.fn() },
    trainingProgress: { findMany: vi.fn() },
  },
}));

import { getTrainingSummary } from "@/lib/reporting/training";
import { parsePilotOnly, resolveScopeParams } from "@/lib/reporting/scope";
import { prisma } from "@/lib/db";

describe("reporting scope", () => {
  it("defaults to school scope and uses user schoolId", () => {
    const user = { id: "u1", role: "ADMIN" as const, schoolId: "s1", isPlatformAdmin: false };
    const resolved = resolveScopeParams({ scopeParam: null, scopeIdParam: null, user });
    expect(resolved).toEqual({ scope: "school", scopeId: "s1" });
  });

  it("blocks county scope for non-platform admin", () => {
    const user = { id: "u1", role: "ADMIN" as const, schoolId: "s1", isPlatformAdmin: false };
    expect(() =>
      resolveScopeParams({ scopeParam: "county", scopeIdParam: "Montserrado", user })
    ).toThrow("Forbidden");
  });

  it("allows county scope for platform admin", () => {
    const user = { id: "u1", role: "ADMIN" as const, schoolId: "s1", isPlatformAdmin: true };
    const resolved = resolveScopeParams({ scopeParam: "county", scopeIdParam: "Montserrado", user });
    expect(resolved).toEqual({ scope: "county", scopeId: "Montserrado" });
  });

  it("pilotOnly defaults to true when omitted", () => {
    const user = { id: "u1", role: "ADMIN" as const, schoolId: "s1", isPlatformAdmin: false };
    expect(parsePilotOnly(undefined, user)).toBe(true);
  });
});

describe("training aggregator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stable totals and module breakdown", async () => {
    (prisma.trainingModule.findMany as any).mockResolvedValue([
      { id: "m1", code: "W0", title: "Week 0" },
      { id: "m2", code: "L1", title: "Level 1" },
    ]);

    (prisma.trainingProgress.findMany as any).mockResolvedValue([
      { moduleId: "m1", status: "complete", teacherUserId: "t1" },
      { moduleId: "m1", status: "in_progress", teacherUserId: "t2" },
      { moduleId: "m2", status: "not_started", teacherUserId: "t1" },
      { moduleId: "m2", status: "complete", teacherUserId: "t2" },
      { moduleId: "m2", status: "complete", teacherUserId: "t3" },
    ]);

    const summary = await getTrainingSummary({
      scope: "school",
      scopeId: "s1",
      pilotOnly: true,
    });

    expect(summary.totals).toEqual({
      teachers: 3,
      modules: 2,
      assigned: 5,
      completed: 3,
      inProgress: 1,
      notStarted: 1,
      completionRate: 0.6,
    });

    expect(summary.modules).toEqual([
      {
        moduleId: "m1",
        code: "W0",
        title: "Week 0",
        total: 2,
        completed: 1,
        inProgress: 1,
        notStarted: 0,
        completionRate: 0.5,
      },
      {
        moduleId: "m2",
        code: "L1",
        title: "Level 1",
        total: 3,
        completed: 2,
        inProgress: 0,
        notStarted: 1,
        completionRate: 0.667,
      },
    ]);
  });

  it("applies county scope filters in query", async () => {
    (prisma.trainingModule.findMany as any).mockResolvedValue([]);
    (prisma.trainingProgress.findMany as any).mockResolvedValue([]);

    await getTrainingSummary({
      scope: "county",
      scopeId: "Bong",
      pilotOnly: true,
    });

    expect(prisma.trainingProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          User: expect.objectContaining({
            school: { county: "Bong" },
          }),
        }),
      })
    );
  });
});

