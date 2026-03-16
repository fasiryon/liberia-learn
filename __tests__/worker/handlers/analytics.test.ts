import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRdsFindFirst = vi.hoisted(() => vi.fn());
const mockRdsCreate = vi.hoisted(() => vi.fn());
const mockRdsUpdate = vi.hoisted(() => vi.fn());
const mockLogRdsDualWriteError = vi.hoisted(() => vi.fn());
const mockIsRdsDualWriteEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    studentProgress: { findMany: mockFindMany },
    longitudinalSnapshot: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
  rdsPrisma: {
    longitudinalSnapshot: {
      findFirst: mockRdsFindFirst,
      create: mockRdsCreate,
      update: mockRdsUpdate,
    },
  },
  isRdsDualWriteEnabled: mockIsRdsDualWriteEnabled,
  logRdsDualWriteError: mockLogRdsDualWriteError,
}));

import { handleSnapshotAnalyticsJob } from "@/worker/handlers/analytics";

describe("handleSnapshotAnalyticsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "snap-1" });
    mockUpdate.mockResolvedValue({ id: "snap-1" });
    mockRdsFindFirst.mockResolvedValue(null);
    mockRdsCreate.mockResolvedValue({ id: "rds-snap-1" });
    mockRdsUpdate.mockResolvedValue({ id: "rds-snap-1" });
    mockIsRdsDualWriteEnabled.mockReturnValue(true);
    mockFindMany.mockResolvedValue([
      {
        studentId: "student-1",
        exitTicketScore: 80,
        scheduledWork: { content: { subject: "MATH" } },
      },
      {
        studentId: "student-1",
        exitTicketScore: 60,
        scheduledWork: { content: { subject: "MATH" } },
      },
    ]);
  });

  it("writes daily analytics snapshots to primary and RDS clients", async () => {
    const result = await handleSnapshotAnalyticsJob({ schoolId: "school-1" });

    expect(result).toEqual({ snapshotsWritten: 1, sampleSize: 2 });
    expect(mockCreate).toHaveBeenCalled();
    expect(mockRdsCreate).toHaveBeenCalled();
  });

  it("logs RDS failures without failing the primary write", async () => {
    mockRdsCreate.mockRejectedValue(new Error("rds down"));

    await expect(
      handleSnapshotAnalyticsJob({ schoolId: "school-1" })
    ).resolves.toEqual({ snapshotsWritten: 1, sampleSize: 2 });

    expect(mockCreate).toHaveBeenCalled();
    expect(mockLogRdsDualWriteError).toHaveBeenCalledWith(
      "analytics.longitudinalSnapshot",
      expect.any(Error)
    );
  });
});
