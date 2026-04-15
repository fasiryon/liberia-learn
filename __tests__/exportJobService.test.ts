import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrismaExportJobRequest = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogDataAccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { exportJobRequest: mockPrismaExportJobRequest },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/dataAccess/logDataAccess", () => ({ logDataAccess: mockLogDataAccess }));

import {
  createExportJob,
  approveExportJob,
  rejectExportJob,
  getExportDownload,
  listExportJobs,
} from "@/lib/exports/exportJobService";

const BASE_JOB = {
  id: "job-1",
  scope: "school",
  exportType: "student_performance",
  format: "csv",
  status: "pending",
  approvalStatus: "pending",
  requestedAt: new Date("2026-04-14T00:00:00Z"),
  approvedAt: null,
  completedAt: null,
  downloadUrl: null,
  schoolId: "school-1",
};

describe("exportJobService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockLogDataAccess.mockResolvedValue(undefined);
  });

  describe("createExportJob", () => {
    it("creates a pending export job and fires audit", async () => {
      mockPrismaExportJobRequest.create.mockResolvedValue(BASE_JOB);
      const result = await createExportJob({
        requestedByUserId: "user-1",
        schoolId: "school-1",
        scope: "school",
        exportType: "student_performance",
        format: "csv",
      });
      expect(result.id).toBe("job-1");
      expect(result.approvalStatus).toBe("pending");
      expect(mockPrismaExportJobRequest.create).toHaveBeenCalledOnce();
    });
  });

  describe("approveExportJob", () => {
    it("approves a pending job", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue(BASE_JOB);
      mockPrismaExportJobRequest.update.mockResolvedValue({
        ...BASE_JOB,
        approvalStatus: "approved",
        status: "approved",
        approvedAt: new Date(),
        approvedByUserId: "admin-1",
      });
      const result = await approveExportJob({ jobId: "job-1", approvedByUserId: "admin-1" });
      expect(result.approvalStatus).toBe("approved");
      expect(mockPrismaExportJobRequest.update).toHaveBeenCalledOnce();
    });

    it("throws 404 if job not found", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue(null);
      await expect(approveExportJob({ jobId: "bad-id", approvedByUserId: "admin-1" })).rejects.toMatchObject({
        status: 404,
      });
    });

    it("throws 409 if already approved", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue({
        ...BASE_JOB,
        approvalStatus: "approved",
      });
      await expect(approveExportJob({ jobId: "job-1", approvedByUserId: "admin-1" })).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe("rejectExportJob", () => {
    it("rejects a pending job", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue(BASE_JOB);
      mockPrismaExportJobRequest.update.mockResolvedValue({
        ...BASE_JOB,
        approvalStatus: "rejected",
        status: "rejected",
      });
      const result = await rejectExportJob({
        jobId: "job-1",
        rejectedByUserId: "admin-1",
        reason: "not authorized",
      });
      expect(result.approvalStatus).toBe("rejected");
    });
  });

  describe("getExportDownload", () => {
    it("returns downloadUrl for completed job and fires audit", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue({
        ...BASE_JOB,
        status: "completed",
        downloadUrl: "https://s3.example.com/export.csv?token=abc",
      });
      const url = await getExportDownload({ jobId: "job-1", userId: "user-1" });
      expect(url).toContain("s3.example.com");
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "export.job.download" })
      );
    });

    it("throws 409 if job not completed", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue(BASE_JOB);
      await expect(getExportDownload({ jobId: "job-1", userId: "user-1" })).rejects.toMatchObject({
        status: 409,
      });
    });

    it("throws 404 if job not found", async () => {
      mockPrismaExportJobRequest.findUnique.mockResolvedValue(null);
      await expect(getExportDownload({ jobId: "bad", userId: "user-1" })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("listExportJobs", () => {
    it("returns paginated job list", async () => {
      mockPrismaExportJobRequest.count.mockResolvedValue(1);
      mockPrismaExportJobRequest.findMany.mockResolvedValue([BASE_JOB]);
      const result = await listExportJobs({ approvalStatus: "pending" });
      expect(result.total).toBe(1);
      expect(result.jobs).toHaveLength(1);
    });
  });
});
