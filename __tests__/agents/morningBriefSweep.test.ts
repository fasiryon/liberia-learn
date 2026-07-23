import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClassFindMany = vi.hoisted(() => vi.fn());
const mockTeacherMorningBriefFindUnique = vi.hoisted(() => vi.fn());
const mockRunAgent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: mockClassFindMany },
    teacherMorningBrief: { findUnique: mockTeacherMorningBriefFindUnique },
  },
}));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));

import { runMorningBriefSweep } from "@/lib/agents/morningBrief/sweep";

const NOW = new Date("2026-07-22T05:00:00.000Z");

describe("runMorningBriefSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the agent once per distinct teacher who does not already have today's brief", async () => {
    mockClassFindMany.mockResolvedValue([{ teacherId: "teacher-1" }, { teacherId: "teacher-2" }]);
    mockTeacherMorningBriefFindUnique.mockResolvedValue(null);
    mockRunAgent.mockResolvedValue({ invocationId: "inv-1" });

    const result = await runMorningBriefSweep(NOW);

    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    expect(result.items.every((i) => i.outcome === "generated")).toBe(true);
  });

  it("skips a teacher who already has today's brief, without invoking the agent", async () => {
    mockClassFindMany.mockResolvedValue([{ teacherId: "teacher-1" }]);
    mockTeacherMorningBriefFindUnique.mockResolvedValue({ id: "existing-brief" });

    const result = await runMorningBriefSweep(NOW);

    expect(mockRunAgent).not.toHaveBeenCalled();
    expect(result.items).toEqual([{ teacherUserId: "teacher-1", outcome: "already_exists" }]);
  });

  it("records invoke_failed for a teacher without failing the whole sweep", async () => {
    mockClassFindMany.mockResolvedValue([{ teacherId: "teacher-1" }, { teacherId: "teacher-2" }]);
    mockTeacherMorningBriefFindUnique.mockResolvedValue(null);
    mockRunAgent
      .mockRejectedValueOnce(new Error("cost cap exceeded"))
      .mockResolvedValueOnce({ invocationId: "inv-2" });

    const result = await runMorningBriefSweep(NOW);

    expect(result.items).toEqual([
      { teacherUserId: "teacher-1", outcome: "invoke_failed" },
      { teacherUserId: "teacher-2", outcome: "generated", invocationId: "inv-2" },
    ]);
  });

  it("uses UTC midnight of the given date as the briefDate key", async () => {
    mockClassFindMany.mockResolvedValue([{ teacherId: "teacher-1" }]);
    mockTeacherMorningBriefFindUnique.mockResolvedValue(null);
    mockRunAgent.mockResolvedValue({ invocationId: "inv-1" });

    await runMorningBriefSweep(NOW);

    expect(mockTeacherMorningBriefFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teacherUserId_briefDate: { teacherUserId: "teacher-1", briefDate: new Date("2026-07-22T00:00:00.000Z") } },
      })
    );
  });
});
