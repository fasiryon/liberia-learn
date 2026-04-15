// lib/exports/exportJobService.ts — Sprint 7
// ExportJobRequest approval workflow.
// Platform-admin-only: create → approve → generate → upload → timed download (24h).
// All steps audited via logAudit().

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logDataAccess } from "@/lib/dataAccess/logDataAccess";

const DOWNLOAD_URL_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export type ExportScope = "school" | "national" | "district";
export type ExportType =
  | "student_performance"
  | "class_summary"
  | "monthly_report"
  | "intervention_effectiveness"
  | "ai_usage";
export type ExportFormat = "csv" | "json";

export interface CreateExportJobInput {
  requestedByUserId: string;
  schoolId?: string | null;
  scope: ExportScope;
  scopeId?: string | null;
  exportType: ExportType;
  format?: ExportFormat;
  filters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

export interface ApproveExportJobInput {
  jobId: string;
  approvedByUserId: string;
  traceId?: string;
}

export interface DownloadExportJobInput {
  jobId: string;
  userId: string;
  traceId?: string;
}

export interface ExportJobSummary {
  id: string;
  scope: string;
  exportType: string;
  format: string;
  status: string;
  approvalStatus: string;
  requestedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  downloadUrl: string | null;
}

/** Create a new pending export job request. */
export async function createExportJob(input: CreateExportJobInput): Promise<ExportJobSummary> {
  const traceId = input.traceId ?? randomUUID();

  const job = await prisma.exportJobRequest.create({
    data: {
      requestedByUserId: input.requestedByUserId,
      schoolId: input.schoolId ?? null,
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      exportType: input.exportType,
      format: input.format ?? "csv",
      status: "pending",
      approvalStatus: "pending",
      filters: (input.filters as never) ?? undefined,
      metadata: (input.metadata as never) ?? undefined,
    },
  });

  void logAudit({
    userId: input.requestedByUserId,
    schoolId: input.schoolId ?? null,
    action: "export.job.created",
    resourceType: "export_job",
    resourceId: job.id,
    traceId,
    details: { scope: input.scope, exportType: input.exportType, format: input.format },
  });
  void logDataAccess({
    userId: input.requestedByUserId,
    schoolId: input.schoolId ?? null,
    resourceType: "export_job",
    resourceId: job.id,
    action: "create",
    scope: input.scope,
    traceId,
  });

  return toSummary(job);
}

/** Approve a pending export job. Marks approvalStatus=approved. */
export async function approveExportJob(input: ApproveExportJobInput): Promise<ExportJobSummary> {
  const traceId = input.traceId ?? randomUUID();

  const job = await prisma.exportJobRequest.findUnique({ where: { id: input.jobId } });
  if (!job) throw Object.assign(new Error("Export job not found"), { status: 404 });
  if (job.approvalStatus !== "pending") {
    throw Object.assign(new Error(`Job already ${job.approvalStatus}`), { status: 409 });
  }

  const updated = await prisma.exportJobRequest.update({
    where: { id: input.jobId },
    data: {
      approvalStatus: "approved",
      approvedByUserId: input.approvedByUserId,
      approvedAt: new Date(),
      status: "approved",
    },
  });

  void logAudit({
    userId: input.approvedByUserId,
    schoolId: job.schoolId,
    action: "export.job.approved",
    resourceType: "export_job",
    resourceId: job.id,
    traceId,
    details: { scope: job.scope, exportType: job.exportType },
  });

  return toSummary(updated);
}

/** Reject a pending export job. */
export async function rejectExportJob({
  jobId,
  rejectedByUserId,
  reason,
  traceId,
}: {
  jobId: string;
  rejectedByUserId: string;
  reason?: string;
  traceId?: string;
}): Promise<ExportJobSummary> {
  const job = await prisma.exportJobRequest.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error("Export job not found"), { status: 404 });
  if (job.approvalStatus !== "pending") {
    throw Object.assign(new Error(`Job already ${job.approvalStatus}`), { status: 409 });
  }

  const updated = await prisma.exportJobRequest.update({
    where: { id: jobId },
    data: { approvalStatus: "rejected", status: "rejected" },
  });

  void logAudit({
    userId: rejectedByUserId,
    schoolId: job.schoolId,
    action: "export.job.rejected",
    resourceType: "export_job",
    resourceId: jobId,
    traceId: traceId ?? randomUUID(),
    details: { scope: job.scope, exportType: job.exportType, reason },
  });

  return toSummary(updated);
}

/**
 * Mark a job as completed with a stored download URL.
 * The URL is a 24-hour presigned S3 link generated at upload time.
 */
export async function completeExportJob({
  jobId,
  downloadUrl,
  checksum,
  traceId,
}: {
  jobId: string;
  downloadUrl: string;
  checksum?: string;
  traceId?: string;
}): Promise<ExportJobSummary> {
  const updated = await prisma.exportJobRequest.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      downloadUrl,
      checksum: checksum ?? null,
    },
  });

  void logAudit({
    userId: null,
    action: "export.job.completed",
    resourceType: "export_job",
    resourceId: jobId,
    traceId: traceId ?? randomUUID(),
    details: { checksum },
  });

  return toSummary(updated);
}

/** Get download URL for a completed job. Audits the download access. */
export async function getExportDownload(input: DownloadExportJobInput): Promise<string> {
  const traceId = input.traceId ?? randomUUID();

  const job = await prisma.exportJobRequest.findUnique({ where: { id: input.jobId } });
  if (!job) throw Object.assign(new Error("Export job not found"), { status: 404 });
  if (job.status !== "completed") {
    throw Object.assign(new Error("Export not yet ready"), { status: 409 });
  }
  if (!job.downloadUrl) {
    throw Object.assign(new Error("Download URL not available"), { status: 404 });
  }

  void logAudit({
    userId: input.userId,
    schoolId: job.schoolId,
    action: "export.job.download",
    resourceType: "export_job",
    resourceId: job.id,
    traceId,
    details: { scope: job.scope, exportType: job.exportType },
  });
  void logDataAccess({
    userId: input.userId,
    schoolId: job.schoolId,
    resourceType: "export_job",
    resourceId: job.id,
    action: "download",
    scope: job.scope,
    traceId,
  });

  return job.downloadUrl;
}

/** List export jobs (paginated). Platform admin sees all; school admin sees their school. */
export async function listExportJobs({
  schoolId,
  approvalStatus,
  page = 1,
  pageSize = 20,
}: {
  schoolId?: string | null;
  approvalStatus?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ total: number; page: number; pageSize: number; jobs: ExportJobSummary[] }> {
  const where: Record<string, unknown> = {};
  if (schoolId) where.schoolId = schoolId;
  if (approvalStatus) where.approvalStatus = approvalStatus;

  const [total, jobs] = await Promise.all([
    prisma.exportJobRequest.count({ where }),
    prisma.exportJobRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, jobs: jobs.map(toSummary) };
}

function toSummary(job: {
  id: string;
  scope: string;
  exportType: string;
  format: string;
  status: string;
  approvalStatus: string;
  requestedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  downloadUrl: string | null;
}): ExportJobSummary {
  return {
    id: job.id,
    scope: job.scope,
    exportType: job.exportType,
    format: job.format,
    status: job.status,
    approvalStatus: job.approvalStatus,
    requestedAt: job.requestedAt,
    approvedAt: job.approvedAt,
    completedAt: job.completedAt,
    downloadUrl: job.downloadUrl,
  };
}

/** TTL constant for governed export download links (24h). */
export const GOVERNED_EXPORT_TTL_SECONDS = DOWNLOAD_URL_TTL_SECONDS;
