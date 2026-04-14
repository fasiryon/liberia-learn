import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMasterySnapshotFindFirst = vi.hoisted(() => vi.fn());
const mockMasterySnapshotCreate = vi.hoisted(() => vi.fn());
const mockInterventionChainCount = vi.hoisted(() => vi.fn());
const mockMisconceptionTagCount = vi.hoisted(() => vi.fn());
const mockDerivedStudentProgressCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    masterySnapshot: {
      findFirst: mockMasterySnapshotFindFirst,
      create: mockMasterySnapshotCreate,
    },
    interventionChain: {
      count: mockInterventionChainCount,
    },
    misconceptionTag: {
      count: mockMisconceptionTagCount,
    },
    derivedStudentProgress: {
      create: mockDerivedStudentProgressCreate,
    },
  },
}));

import {
  appendDerivedStudentProgress,
  appendMasterySnapshot,
} from "@/lib/intelligence/derivedProgress";

describe("derived progress services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMasterySnapshotFindFirst.mockResolvedValue({ id: "snapshot-prev" });
    mockMasterySnapshotCreate.mockResolvedValue({ id: "snapshot-next" });
    mockInterventionChainCount.mockResolvedValue(2);
    mockMisconceptionTagCount.mockResolvedValue(1);
    mockDerivedStudentProgressCreate.mockResolvedValue({ id: "derived-1" });
  });

  it("appends a mastery snapshot linked to the previous snapshot", async () => {
    await appendMasterySnapshot({
      studentId: "student-1",
      schoolId: "school-1",
      subject: "MATH",
      strandKey: "fractions",
      sourceAttemptId: "attempt-1",
      currentScore: 0.8,
    });

    expect(mockMasterySnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousSnapshotId: "snapshot-prev",
          snapshotType: "progress_refresh",
          sourceAttemptId: "attempt-1",
        }),
      })
    );
  });

  it("writes derived student progress separately from source records", async () => {
    await appendDerivedStudentProgress({
      studentId: "student-1",
      schoolId: "school-1",
      subject: "MATH",
      strandKey: "fractions",
      sourceAttemptId: "attempt-1",
      sourceSnapshotId: "snapshot-next",
      currentScore: 0.8,
    });

    expect(mockInterventionChainCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "student-1",
          status: "open",
        }),
      })
    );
    expect(mockDerivedStudentProgressCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceAttemptId: "attempt-1",
          sourceSnapshotId: "snapshot-next",
          openInterventionChainCount: 2,
          misconceptionCount: 1,
        }),
      })
    );
  });
});
