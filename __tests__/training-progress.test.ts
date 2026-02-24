/**
 * __tests__/training-progress.test.ts
 *
 * Tests for:
 *   • Badge computation (pure functions — no DB)
 *   • isLevelComplete (pure function)
 *   • markModuleStarted / markModuleComplete (DB-mocked)
 *   • getTeacherProgress (DB-mocked)
 *   • Tenant isolation contract (progress scoped to teacherUserId)
 *
 * Vitest environment: node (no jsdom — all functions are SSR-safe)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeEarnedBadges, isLevelComplete, LEVEL_BADGES } from "@/lib/training/badges";
import { TRAINING_MODULES, MODULES_BY_LEVEL } from "@/lib/training/modules";
import type { ModuleProgressRecord } from "@/lib/training/progress";

// ── Prisma mock ───────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  prisma: {
    trainingProgress: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  getTeacherProgress,
  markModuleStarted,
  markModuleComplete,
} from "@/lib/training/progress";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completeAll(level: 1 | 2 | 3): ModuleProgressRecord[] {
  return MODULES_BY_LEVEL[level].map((m) => ({
    moduleId: m.id,
    status: "complete" as const,
    startedAt: new Date(),
    completedAt: new Date(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("computeEarnedBadges", () => {
  it("returns [] when no progress at all", () => {
    expect(computeEarnedBadges([])).toEqual([]);
  });

  it("returns no badge when only some Level 1 modules are complete", () => {
    const partial: ModuleProgressRecord[] = [
      { moduleId: MODULES_BY_LEVEL[1][0].id, status: "complete", startedAt: new Date(), completedAt: new Date() },
    ];
    expect(computeEarnedBadges(partial)).toEqual([]);
  });

  it("returns Level 1 badge when all Level 1 modules are complete", () => {
    const badges = computeEarnedBadges(completeAll(1));
    expect(badges).toHaveLength(1);
    expect(badges[0].name).toBe("level_1_certified");
    expect(badges[0].level).toBe(1);
  });

  it("does not award Level 1 badge for in_progress modules", () => {
    const inProgress: ModuleProgressRecord[] = MODULES_BY_LEVEL[1].map((m) => ({
      moduleId: m.id,
      status: "in_progress" as const,
      startedAt: new Date(),
      completedAt: null,
    }));
    expect(computeEarnedBadges(inProgress)).toEqual([]);
  });

  it("returns Level 2 badge when all Level 2 modules are complete", () => {
    const badges = computeEarnedBadges(completeAll(2));
    expect(badges).toHaveLength(1);
    expect(badges[0].name).toBe("level_2_certified");
  });

  it("returns Level 3 badge when all Level 3 modules are complete", () => {
    const badges = computeEarnedBadges(completeAll(3));
    expect(badges).toHaveLength(1);
    expect(badges[0].name).toBe("level_3_certified");
  });

  it("returns all 3 badges when every module is complete", () => {
    const all: ModuleProgressRecord[] = TRAINING_MODULES.map((m) => ({
      moduleId: m.id,
      status: "complete" as const,
      startedAt: new Date(),
      completedAt: new Date(),
    }));
    const badges = computeEarnedBadges(all);
    expect(badges).toHaveLength(3);
    expect(badges.map((b) => b.name)).toEqual([
      "level_1_certified",
      "level_2_certified",
      "level_3_certified",
    ]);
  });

  it("awards Level 1 + Level 2 but not Level 3 when L3 incomplete", () => {
    const progress: ModuleProgressRecord[] = [
      ...completeAll(1),
      ...completeAll(2),
      // Level 3 — only first module complete
      { moduleId: MODULES_BY_LEVEL[3][0].id, status: "complete", startedAt: new Date(), completedAt: new Date() },
    ];
    const badges = computeEarnedBadges(progress);
    expect(badges).toHaveLength(2);
    expect(badges.map((b) => b.level)).toEqual([1, 2]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("isLevelComplete", () => {
  it("returns false for empty progress", () => {
    expect(isLevelComplete(1, [])).toBe(false);
    expect(isLevelComplete(2, [])).toBe(false);
    expect(isLevelComplete(3, [])).toBe(false);
  });

  it("returns true when all Level 1 modules are complete", () => {
    expect(isLevelComplete(1, completeAll(1))).toBe(true);
  });

  it("returns false when one Level 1 module is still in_progress", () => {
    const progress: ModuleProgressRecord[] = [
      { moduleId: MODULES_BY_LEVEL[1][0].id, status: "complete", startedAt: new Date(), completedAt: new Date() },
      { moduleId: MODULES_BY_LEVEL[1][1].id, status: "in_progress", startedAt: new Date(), completedAt: null },
    ];
    expect(isLevelComplete(1, progress)).toBe(false);
  });

  it("ignores modules from other levels", () => {
    // Level 2 + 3 all done, Level 1 not started → Level 1 still incomplete
    const progress = [...completeAll(2), ...completeAll(3)];
    expect(isLevelComplete(1, progress)).toBe(false);
    expect(isLevelComplete(2, progress)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("LEVEL_BADGES", () => {
  it("has correct names and levels", () => {
    expect(LEVEL_BADGES[1].name).toBe("level_1_certified");
    expect(LEVEL_BADGES[2].name).toBe("level_2_certified");
    expect(LEVEL_BADGES[3].name).toBe("level_3_certified");
    expect(LEVEL_BADGES[1].level).toBe(1);
    expect(LEVEL_BADGES[2].level).toBe(2);
    expect(LEVEL_BADGES[3].level).toBe(3);
  });

  it("every badge has a non-empty emoji and label", () => {
    for (const badge of Object.values(LEVEL_BADGES)) {
      expect(badge.emoji.length).toBeGreaterThan(0);
      expect(badge.label.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("getTeacherProgress", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns mapped progress records", async () => {
    (prisma.trainingProgress.findMany as any).mockResolvedValue([
      { moduleId: "l1-login-nav", status: "complete", startedAt: new Date("2026-01-01"), completedAt: new Date("2026-01-01") },
      { moduleId: "l1-class-work", status: "in_progress", startedAt: new Date("2026-01-02"), completedAt: null },
    ]);

    const progress = await getTeacherProgress("teacher-1");

    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ moduleId: "l1-login-nav", status: "complete" });
    expect(progress[1]).toMatchObject({ moduleId: "l1-class-work", status: "in_progress" });
  });

  it("passes teacherUserId as the only filter — tenant isolation contract", async () => {
    (prisma.trainingProgress.findMany as any).mockResolvedValue([]);

    await getTeacherProgress("user-abc");

    expect(prisma.trainingProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherUserId: "user-abc" },
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("markModuleStarted", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates a new in_progress record when none exists", async () => {
    (prisma.trainingProgress.findUnique as any).mockResolvedValue(null);
    (prisma.trainingProgress.create as any).mockResolvedValue({});

    await markModuleStarted("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teacherUserId: "teacher-1",
          moduleId: "l1-login-nav",
          status: "in_progress",
        }),
      })
    );
  });

  it("advances from not_started to in_progress", async () => {
    (prisma.trainingProgress.findUnique as any).mockResolvedValue({ status: "not_started" });
    (prisma.trainingProgress.update as any).mockResolvedValue({});

    await markModuleStarted("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "in_progress" }),
      })
    );
  });

  it("does NOT downgrade a complete module to in_progress", async () => {
    (prisma.trainingProgress.findUnique as any).mockResolvedValue({ status: "complete" });

    await markModuleStarted("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.create).not.toHaveBeenCalled();
    expect(prisma.trainingProgress.update).not.toHaveBeenCalled();
  });

  it("does nothing when already in_progress", async () => {
    (prisma.trainingProgress.findUnique as any).mockResolvedValue({ status: "in_progress" });

    await markModuleStarted("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.create).not.toHaveBeenCalled();
    expect(prisma.trainingProgress.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("markModuleComplete", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("upserts with status=complete and a completedAt timestamp", async () => {
    (prisma.trainingProgress.upsert as any).mockResolvedValue({});

    await markModuleComplete("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          teacherUserId: "teacher-1",
          moduleId: "l1-login-nav",
          status: "complete",
        }),
        update: expect.objectContaining({
          status: "complete",
        }),
      })
    );
  });

  it("is idempotent — calling twice does not throw", async () => {
    (prisma.trainingProgress.upsert as any).mockResolvedValue({});

    await markModuleComplete("teacher-1", "l1-login-nav");
    await markModuleComplete("teacher-1", "l1-login-nav");

    expect(prisma.trainingProgress.upsert).toHaveBeenCalledTimes(2);
  });
});
