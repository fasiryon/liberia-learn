import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRAINING_MODULES } from "@/lib/training/modules";
import { TRAINING_RECORD_DISCLAIMER, getTrainingCompletionRecord } from "@/lib/training/completionRecord";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    trainingProgress: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("training completion record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue({
      name: "Amina Doe",
      email: "amina@example.com",
      school: { name: "Central High" },
    });
  });

  it("does not generate a record code until all modules are complete", async () => {
    (prisma.trainingProgress.findMany as any).mockResolvedValue([
      {
        moduleId: TRAINING_MODULES[0].id,
        status: "complete",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        completedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);

    const record = await getTrainingCompletionRecord("teacher-1");

    expect(record.completed).toBe(false);
    expect(record.recordCode).toBeNull();
    expect(record.completedModules).toBe(1);
  });

  it("generates a deterministic platform training record when all modules are complete", async () => {
    (prisma.trainingProgress.findMany as any).mockResolvedValue(
      TRAINING_MODULES.map((module, index) => ({
        moduleId: module.id,
        status: "complete",
        startedAt: new Date("2026-07-01T00:00:00.000Z"),
        completedAt: new Date(`2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
      }))
    );

    const record = await getTrainingCompletionRecord("teacher-1");

    expect(record.completed).toBe(true);
    expect(record.recordCode).toMatch(/^[A-F0-9]{10}$/);
    expect(record.badges.map((badge) => badge.label)).toEqual([
      "Level 1 Training Badge",
      "Level 2 Training Badge",
      "Level 3 Training Badge",
    ]);
  });

  it("uses the approved disclaimer wording", () => {
    expect(TRAINING_RECORD_DISCLAIMER).toBe(
      "This record confirms completion of LiberiaLearn platform training modules. It reflects platform proficiency only and is not an official teacher license, Ministry of Education qualification, government-issued credential, or employment requirement."
    );
  });
});
