import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { prisma } from "@/lib/db";
import { validateRegeneratedLesson, extractLessonText } from "@/lib/curriculum/regenerationQualityGate";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";

type JsonRecord = Record<string, any>;

const PLACEHOLDER_OR_MOJIBAKE = /\bTODO\b|\bTBD\b|\[insert\b|lorem ipsum|placeholder|as an ai language model|i'?m sorry|i cannot|Ãƒ|Ã‚|Ã¢â‚¬|Ã¢â‚¬Å“|Ã¢â‚¬\u009d|ï¿½/i;

function numericEnv(name: string, fallback: number) {
  const parsed = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isCurriculumRegenSchedulerEnabled() {
  return process.env.ENABLE_CURRICULUM_REGEN_SCHEDULER?.trim() === "true";
}

export function getSchedulerConfig() {
  return {
    maxLessons: Math.max(1, Math.min(50, Math.trunc(numericEnv("CURRICULUM_REGEN_SCHEDULER_MAX_LESSONS", 10)))),
    minutesBetweenRuns: Math.max(5, Math.trunc(numericEnv("CURRICULUM_REGEN_SCHEDULER_MINUTES_BETWEEN_RUNS", 30))),
    maxFailureRate: Math.max(0, Math.min(1, numericEnv("CURRICULUM_REGEN_SCHEDULER_MAX_FAILURE_RATE", 0.2))),
  };
}

export function hasPlaceholderOrMojibake(payload: unknown) {
  return PLACEHOLDER_OR_MOJIBAKE.test(extractLessonText(payload));
}

function contentLength(payload: unknown) {
  return extractLessonText(payload).length;
}

function qualityReason(payload: unknown) {
  const p = payload && typeof payload === "object" ? (payload as JsonRecord) : {};
  const meta = p.generationMetadata ?? p.upgradeMetadata ?? {};
  return meta.qualityFailureReason ?? meta.qualityGateReason ?? p.qualityFailureReason ?? null;
}

function providerName(job: { provider?: string | null }) {
  return job.provider?.trim() || "default";
}

async function getQueueDepth() {
  const queueUrl = process.env.SQS_QUEUE_URL?.trim();
  if (!queueUrl) return null;
  try {
    const client = new SQSClient({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    });
    const result = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
      })
    );
    const visible = Number(result.Attributes?.ApproximateNumberOfMessages ?? 0);
    const notVisible = Number(result.Attributes?.ApproximateNumberOfMessagesNotVisible ?? 0);
    return { visible, notVisible, total: visible + notVisible };
  } catch {
    return { visible: null, notVisible: null, total: null, unavailable: true };
  }
}

export async function getCurriculumRegenerationOpsData() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [runs, runCounts, jobCounts, latestErrors, auditEvents, queueDepth, contentRows, jobs] = await Promise.all([
    prisma.curriculumRegenerationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        status: true,
        totalPlanned: true,
        totalProcessed: true,
        totalApproved: true,
        totalFailed: true,
        currentGradeLevel: true,
        currentSubject: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        stoppedReason: true,
      },
    }),
    prisma.curriculumRegenerationRun.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.curriculumRegenerationJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.curriculumRegenerationJob.findMany({
      where: { lastErrorMessage: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        runId: true,
        curriculumContentId: true,
        gradeLevel: true,
        subject: true,
        status: true,
        attempt: true,
        provider: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "curriculum." } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, resourceType: true, resourceId: true, details: true, createdAt: true },
    }),
    getQueueDepth(),
    prisma.curriculumContent.findMany({
      where: { contentType: "lesson", status: { in: ["NEEDS_REVIEW", "DRAFT", "published"] } },
      select: { contentId: true, grade: true, subject: true, status: true, payload: true },
    }),
    prisma.curriculumRegenerationJob.findMany({
      where: { createdAt: { gte: since } },
      select: { gradeLevel: true, subject: true, status: true, attempt: true, provider: true, lastErrorCode: true },
    }),
  ]);

  const byGradeSubject = new Map<string, any>();
  let approvedThinCount = 0;
  let malformedOutputCount = 0;
  let placeholderCount = 0;
  const qualityReasons = new Map<string, number>();

  for (const row of contentRows) {
    const key = `${row.grade}:${row.subject}`;
    const bucket = byGradeSubject.get(key) ?? {
      grade: row.grade,
      subject: row.subject,
      needsReview: 0,
      draft: 0,
      approvedThin: 0,
      totalContentLength: 0,
      contentRows: 0,
      malformedOutput: 0,
      placeholderOrMojibake: 0,
      failures: 0,
      attempted: 0,
    };
    const length = contentLength(row.payload);
    bucket.totalContentLength += length;
    bucket.contentRows += 1;
    if (row.status === "NEEDS_REVIEW") bucket.needsReview += 1;
    if (row.status === "DRAFT") bucket.draft += 1;
    if (row.status === "published" && length < 800) {
      bucket.approvedThin += 1;
      approvedThinCount += 1;
    }
    const reason = qualityReason(row.payload);
    if (reason) qualityReasons.set(String(reason), (qualityReasons.get(String(reason)) ?? 0) + 1);
    if (!row.payload || typeof row.payload !== "object") {
      bucket.malformedOutput += 1;
      malformedOutputCount += 1;
    }
    if (hasPlaceholderOrMojibake(row.payload)) {
      bucket.placeholderOrMojibake += 1;
      placeholderCount += 1;
    }
    byGradeSubject.set(key, bucket);
  }

  const retryByProvider = new Map<string, { provider: string; jobs: number; retrying: number; retries: number }>();
  for (const job of jobs) {
    const key = providerName(job);
    const provider = retryByProvider.get(key) ?? { provider: key, jobs: 0, retrying: 0, retries: 0 };
    provider.jobs += 1;
    provider.retries += Math.max(0, job.attempt - 1);
    if (job.attempt > 1) provider.retrying += 1;
    retryByProvider.set(key, provider);

    const gsKey = `${job.gradeLevel}:${job.subject}`;
    const bucket = byGradeSubject.get(gsKey) ?? {
      grade: job.gradeLevel,
      subject: job.subject,
      needsReview: 0,
      draft: 0,
      approvedThin: 0,
      totalContentLength: 0,
      contentRows: 0,
      malformedOutput: 0,
      placeholderOrMojibake: 0,
      failures: 0,
      attempted: 0,
    };
    bucket.attempted += 1;
    if (job.status === "failed") bucket.failures += 1;
    byGradeSubject.set(gsKey, bucket);
    if (job.lastErrorCode) qualityReasons.set(job.lastErrorCode, (qualityReasons.get(job.lastErrorCode) ?? 0) + 1);
  }

  const gradeSubject = [...byGradeSubject.values()].map((row) => ({
    ...row,
    averageContentLength: row.contentRows ? Math.round(row.totalContentLength / row.contentRows) : 0,
    failureRate: row.attempted ? Number((row.failures / row.attempted).toFixed(3)) : 0,
  })).sort((a, b) => a.grade - b.grade || String(a.subject).localeCompare(String(b.subject)));

  return {
    generatedAt: new Date().toISOString(),
    queueDepth,
    runs,
    runCounts: Object.fromEntries(runCounts.map((row) => [row.status, row._count._all])),
    jobCounts: Object.fromEntries(jobCounts.map((row) => [row.status, row._count._all])),
    latestErrors,
    auditEvents,
    health: {
      db: "healthy",
      provider: latestErrors.some((error) => error.lastErrorCode === "generation_failed") ? "degraded" : "nominal",
      lastWorkerHeartbeat: null,
    },
    qa: {
      gradeSubject,
      approvedThinCount,
      malformedOutputCount,
      placeholderOrMojibakeCount: placeholderCount,
      qualityGateFailureReasons: [...qualityReasons.entries()].map(([reason, count]) => ({ reason, count })),
      retryRateByProvider: [...retryByProvider.values()].map((row) => ({
        ...row,
        retryRate: row.jobs ? Number((row.retrying / row.jobs).toFixed(3)) : 0,
      })),
    },
  };
}

export async function listCurriculumDrafts(filters: {
  grade?: number;
  subject?: string;
  status?: string;
  limit?: number;
}) {
  const rows = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: filters.status ?? "DRAFT",
      ...(filters.grade ? { grade: filters.grade } : {}),
      ...(filters.subject ? { subject: filters.subject.toUpperCase() } : {}),
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { updatedAt: "desc" }],
    take: Math.min(Math.max(filters.limit ?? 50, 1), 100),
    select: { contentId: true, title: true, grade: true, subject: true, status: true, payload: true, updatedAt: true },
  });
  return rows.map((row) => {
    const quality = validateRegeneratedLesson(row.payload);
    return {
      contentId: row.contentId,
      title: row.title,
      grade: row.grade,
      subject: row.subject,
      status: row.status,
      updatedAt: row.updatedAt,
      contentLength: quality.contentLength,
      qualityPassed: quality.passed,
      qualityReason: quality.reason,
      preview: extractLessonText(row.payload).slice(0, 700),
    };
  });
}

export async function reviewCurriculumDraft(input: {
  action: "approve" | "needs_review" | "reject" | "bulk_approve";
  contentId?: string;
  contentIds?: string[];
  reason?: string;
  actor: { id: string; schoolId?: string | null };
}) {
  const ids = input.action === "bulk_approve" ? input.contentIds ?? [] : input.contentId ? [input.contentId] : [];
  if (ids.length === 0) throw Object.assign(new Error("contentId required"), { status: 400 });

  const records = await prisma.curriculumContent.findMany({
    where: { contentId: { in: ids }, contentType: "lesson" },
  });
  const byId = new Map(records.map((record) => [record.contentId, record]));
  const results: Array<{ contentId: string; ok: boolean; status?: string; error?: string }> = [];

  for (const contentId of ids) {
    const record = byId.get(contentId);
    if (!record) {
      results.push({ contentId, ok: false, error: "not_found" });
      continue;
    }

    if (input.action === "approve" || input.action === "bulk_approve") {
      const quality = validateRegeneratedLesson(record.payload);
      if (!quality.passed) {
        results.push({ contentId, ok: false, error: quality.reason ?? "quality_gate_failed" });
        continue;
      }
      const approvedAt = new Date();
      await appendCurriculumGovernanceEvent({
        contentId,
        eventType: "APPROVED",
        actorType: "USER",
        actorUserId: input.actor.id,
        approvalBasis: "HUMAN_REVIEW",
        reviewAuthority: "PLATFORM",
        reviewerRoleSnapshot: "ADMIN",
        idempotencyKey: `regeneration-approve:${contentId}:${Date.now()}`,
        schoolId: input.actor.schoolId ?? null,
        compatibility: {
          projection: {
            status: "published",
            payload: {
              ...((record.payload as JsonRecord) ?? {}),
              approvalStatus: "APPROVED",
              approvedByUserId: input.actor.id,
              approvedAt: approvedAt.toISOString(),
            },
          },
          auditAction: "curriculum.review.approve",
          auditDetails: {
            bulk: input.action === "bulk_approve",
            contentLength: quality.contentLength,
          },
        },
      });
      results.push({ contentId, ok: true, status: "published" });
      continue;
    }

    if (input.action === "needs_review") {
      if (!input.reason?.trim()) throw Object.assign(new Error("reason required"), { status: 400 });
      await appendCurriculumGovernanceEvent({
        contentId,
        eventType: "RETURNED_FOR_REVIEW",
        actorType: "USER",
        actorUserId: input.actor.id,
        reason: input.reason,
        reviewerRoleSnapshot: "ADMIN",
        idempotencyKey: `regeneration-return:${contentId}:${Date.now()}`,
        schoolId: input.actor.schoolId ?? null,
        compatibility: {
          projection: {
            status: "NEEDS_REVIEW",
            payload: {
              ...((record.payload as JsonRecord) ?? {}),
              approvalStatus: "NEEDS_REVIEW",
              sentBackByUserId: input.actor.id,
              sentBackAt: new Date().toISOString(),
              sentBackReason: input.reason ?? null,
            },
          },
          auditAction: "curriculum.review.needs_review",
          auditDetails: { hasReason: Boolean(input.reason) },
        },
      });
      results.push({ contentId, ok: true, status: "NEEDS_REVIEW" });
      continue;
    }

    if (!input.reason?.trim()) throw Object.assign(new Error("reason required"), { status: 400 });
    await appendCurriculumGovernanceEvent({
      contentId,
      eventType: "REJECTED",
      actorType: "USER",
      actorUserId: input.actor.id,
      reason: input.reason,
      reviewerRoleSnapshot: "ADMIN",
      idempotencyKey: `regeneration-reject:${contentId}:${Date.now()}`,
      schoolId: input.actor.schoolId ?? null,
      compatibility: {
        projection: {
          status: "rejected",
          payload: {
            ...((record.payload as JsonRecord) ?? {}),
            approvalStatus: "REJECTED",
            rejectedByUserId: input.actor.id,
            rejectedAt: new Date().toISOString(),
            rejectionReason: input.reason ?? null,
          },
        },
        auditAction: "curriculum.review.reject",
        auditDetails: { hasReason: Boolean(input.reason) },
      },
    });
    results.push({ contentId, ok: true, status: "rejected" });
  }

  return {
    ok: results.every((result) => result.ok),
    results,
  };
}
