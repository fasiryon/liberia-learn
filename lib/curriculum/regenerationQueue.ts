import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { withProviderRetry, NonRetryableProviderError } from "@/lib/ai/providerRetryPolicy";
import { withDbWriteThrottle } from "@/lib/db/writeThrottle";
import { enqueueJob, JobType } from "@/lib/queue";
import { getSubjectConcurrencyProfile } from "@/lib/curriculum/adaptiveConcurrency";
import { extractLessonText, validateRegeneratedLesson, validateLessonDepth } from "@/lib/curriculum/regenerationQualityGate";
import { isCurriculumRegenQueueEnabled } from "@/lib/serverFlags";

export type CurriculumRegenerationJobPayload = {
  runId: string;
  gradeLevel: number;
  subject: string;
  curriculumContentId: string;
  topic?: string | null;
  attempt?: number;
  provider?: string | null;
  requestedBy?: string | null;
  schoolId?: string | null;
  tenantId?: string | null;
  idempotencyKey: string;
};

export type CurriculumRegenerationGroupPayload = {
  runId: string;
  gradeLevel: number;
  subject: string;
  requestedBy?: string | null;
  provider?: string | null;
};

type NeedsReviewLesson = {
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  payload: unknown;
  moeAlignments: unknown;
};

const TERMINAL_JOB_STATUSES = ["approved", "failed", "skipped"] as const;
const ACTIVE_JOB_STATUSES = ["pending", "processing"] as const;

function normalizeSubject(subject: string) {
  return subject.trim().toUpperCase().replace(/\s+/g, "_");
}

function contentHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

function buildRetryDeduplicationId(idempotencyKey: string, attempt?: number | null) {
  const normalizedAttempt = Math.max(0, Number(attempt ?? 0));
  return normalizedAttempt > 0 ? `${idempotencyKey}:${normalizedAttempt}` : idempotencyKey;
}

export function buildCurriculumRegenerationIdempotencyKey(input: {
  runId: string;
  curriculumContentId: string;
  gradeLevel: number;
  subject: string;
}) {
  return createHash("sha256")
    .update(`${input.runId}:${input.gradeLevel}:${normalizeSubject(input.subject)}:${input.curriculumContentId}`)
    .digest("hex");
}

function alignmentCodes(value: unknown): string[] | undefined {
  // moeAlignments may be the legacy bare array, or the canonical
  // {contentId, standards, alignedAt, method} object the alignment engine writes.
  const arrayValue = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { standards?: unknown }).standards)
      ? (value as { standards: unknown[] }).standards
      : undefined;
  if (!arrayValue) return undefined;
  const codes = arrayValue
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof (item as { code?: unknown }).code === "string") {
        return String((item as { code: string }).code).trim();
      }
      return "";
    })
    .filter(Boolean);
  return codes.length ? codes : undefined;
}

function inferTopic(row: NeedsReviewLesson) {
  const payload = row.payload as { title?: string; metadata?: { topic?: string }; objectives?: string[] } | null;
  return (
    row.title?.trim() ||
    payload?.metadata?.topic?.trim() ||
    payload?.title?.trim() ||
    payload?.objectives?.find((objective) => objective.trim().length > 0)?.trim() ||
    `${row.subject.replace(/_/g, " ")} Grade ${row.grade} ${row.contentId}`
  );
}

async function resolveRequestedBy(requestedBy?: string | null) {
  const value = requestedBy?.trim();
  if (!value) return null;
  const user = await prisma.user.findUnique({ where: { id: value }, select: { id: true } });
  return user?.id ?? null;
}

export async function planCurriculumRegeneration(input: {
  gradeLevel?: number;
  subject?: string;
  limit?: number;
}) {
  const subject = input.subject ? normalizeSubject(input.subject) : undefined;
  const take = Math.min(Math.max(input.limit ?? 23, 1), 500);
  const rows = await prisma.curriculumContent.findMany({
    where: {
      status: "NEEDS_REVIEW",
      contentType: "lesson",
      ...(input.gradeLevel ? { grade: input.gradeLevel } : {}),
      ...(subject ? { subject } : {}),
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { updatedAt: "asc" }, { contentId: "asc" }],
    take,
    select: { contentId: true, title: true, grade: true, subject: true, payload: true, moeAlignments: true },
  });

  const groups = new Map<string, { gradeLevel: number; subject: string; plannedCount: number; jobs: CurriculumRegenerationJobPayload[] }>();
  for (const row of rows) {
    const key = `${row.grade}:${row.subject}`;
    const runId = "DRY_RUN";
    const payload = {
      runId,
      gradeLevel: row.grade,
      subject: row.subject,
      curriculumContentId: row.contentId,
      topic: inferTopic(row),
      attempt: 0,
      provider: null,
      requestedBy: null,
      schoolId: null,
      tenantId: null,
      idempotencyKey: buildCurriculumRegenerationIdempotencyKey({
        runId,
        gradeLevel: row.grade,
        subject: row.subject,
        curriculumContentId: row.contentId,
      }),
    };
    const group = groups.get(key) ?? { gradeLevel: row.grade, subject: row.subject, plannedCount: 0, jobs: [] };
    group.plannedCount += 1;
    group.jobs.push(payload);
    groups.set(key, group);
  }

  return {
    totalPlanned: rows.length,
    groups: [...groups.values()],
  };
}

export async function createCurriculumRegenerationRun(input: {
  gradeLevel?: number;
  subject?: string;
  limit?: number;
  requestedBy?: string | null;
  provider?: string | null;
  dryRun?: boolean;
}) {
  const plan = await planCurriculumRegeneration(input);
  if (input.dryRun) return { dryRun: true, plan };
  if (!isCurriculumRegenQueueEnabled()) {
    throw new Error("ENABLE_CURRICULUM_REGEN_QUEUE must be true to create regeneration jobs.");
  }
  const requestedBy = await resolveRequestedBy(input.requestedBy);

  const run = await prisma.curriculumRegenerationRun.create({
    data: {
      status: "pending",
      targetStatus: "NEEDS_REVIEW",
      totalPlanned: plan.totalPlanned,
      currentGradeLevel: plan.groups[0]?.gradeLevel ?? null,
      currentSubject: plan.groups[0]?.subject ?? null,
    },
  });

  for (const group of plan.groups) {
    await prisma.curriculumRegenerationCheckpoint.upsert({
      where: {
        runId_gradeLevel_subject: {
          runId: run.id,
          gradeLevel: group.gradeLevel,
          subject: group.subject,
        },
      },
      update: { plannedCount: group.plannedCount, status: "pending" },
      create: {
        runId: run.id,
        gradeLevel: group.gradeLevel,
        subject: group.subject,
        plannedCount: group.plannedCount,
        status: "pending",
      },
    });

    for (const planned of group.jobs) {
      const idempotencyKey = buildCurriculumRegenerationIdempotencyKey({
        runId: run.id,
        gradeLevel: planned.gradeLevel,
        subject: planned.subject,
        curriculumContentId: planned.curriculumContentId,
      });
      const job = await prisma.curriculumRegenerationJob.upsert({
        where: { idempotencyKey },
        update: { status: "pending", lastErrorCode: null, lastErrorMessage: null },
        create: {
          runId: run.id,
          curriculumContentId: planned.curriculumContentId,
          gradeLevel: planned.gradeLevel,
          subject: planned.subject,
          topic: planned.topic,
          status: "pending",
          provider: input.provider ?? null,
          requestedBy,
          idempotencyKey,
        },
      });
      const queuePayload = {
        ...planned,
        runId: run.id,
        idempotencyKey,
        attempt: job.attempt,
        provider: input.provider ?? null,
        requestedBy,
      };
      await enqueueJob(JobType.CURRICULUM_REGENERATE_LESSON, queuePayload, {
        messageGroupId: run.id,
        messageDeduplicationId: buildRetryDeduplicationId(idempotencyKey, job.attempt),
      });
    }
  }

  await logAudit({
    userId: requestedBy,
    action: "curriculum.regeneration.run.created",
    resourceType: "curriculum_regeneration_run",
    resourceId: run.id,
    details: { totalPlanned: plan.totalPlanned, groups: plan.groups.map(({ gradeLevel, subject, plannedCount }) => ({ gradeLevel, subject, plannedCount })) },
  });

  return { dryRun: false, runId: run.id, plan };
}

export async function finalizeCurriculumRegenerationRun(runId: string) {
  const [run, activeJobs, statusCounts, checkpoints] = await Promise.all([
    prisma.curriculumRegenerationRun.findUnique({ where: { id: runId } }),
    prisma.curriculumRegenerationJob.count({
      where: { runId, status: { in: [...ACTIVE_JOB_STATUSES] } },
    }),
    prisma.curriculumRegenerationJob.groupBy({
      by: ["status"],
      where: { runId },
      _count: { _all: true },
    }),
    prisma.curriculumRegenerationCheckpoint.findMany({ where: { runId } }),
  ]);

  if (!run || run.status === "completed" || run.status === "completed_with_errors") {
    return { finalized: false, reason: run ? "already_finalized" : "run_not_found" };
  }

  if (activeJobs > 0) {
    return { finalized: false, reason: "active_jobs_remaining", activeJobs };
  }

  const totalJobs = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const terminalJobs = statusCounts
    .filter((row) => (TERMINAL_JOB_STATUSES as readonly string[]).includes(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);

  if (totalJobs === 0 || terminalJobs !== totalJobs) {
    return { finalized: false, reason: "non_terminal_jobs_remaining", totalJobs, terminalJobs };
  }

  const failedCount = statusCounts.find((row) => row.status === "failed")?._count._all ?? 0;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const checkpoint of checkpoints) {
      if (checkpoint.status !== "completed" && checkpoint.processedCount >= checkpoint.plannedCount) {
        await tx.curriculumRegenerationCheckpoint.update({
          where: { id: checkpoint.id },
          data: { status: "completed" },
        });
      }
    }

    await tx.curriculumRegenerationRun.update({
      where: { id: runId },
      data: {
        status: failedCount > 0 ? "completed_with_errors" : "completed",
        completedAt: run.completedAt ?? now,
        stoppedReason:
          failedCount > 0
            ? `Completed with ${failedCount} failed regeneration job${failedCount === 1 ? "" : "s"}.`
            : null,
      },
    });
  });

  return {
    finalized: true,
    status: failedCount > 0 ? "completed_with_errors" : "completed",
    failedCount,
    totalJobs,
  };
}

async function markJobFailed(input: {
  jobId: string;
  runId: string;
  gradeLevel: number;
  subject: string;
  contentId: string;
  code: string;
  message: string;
  retryable: boolean;
}) {
  await withDbWriteThrottle("curriculum.regeneration.job.failed", () =>
    prisma.$transaction(async (tx) => {
      await tx.curriculumRegenerationJob.update({
        where: { id: input.jobId },
        data: {
          status: input.retryable ? "pending" : "failed",
          lastErrorCode: input.code,
          lastErrorMessage: input.message.slice(0, 2000),
        },
      });
      if (!input.retryable) {
        await tx.curriculumRegenerationRun.update({
          where: { id: input.runId },
          data: { totalProcessed: { increment: 1 }, totalFailed: { increment: 1 } },
        });
        await tx.curriculumRegenerationCheckpoint.update({
          where: {
            runId_gradeLevel_subject: {
              runId: input.runId,
              gradeLevel: input.gradeLevel,
              subject: input.subject,
            },
          },
          data: {
            processedCount: { increment: 1 },
            failedCount: { increment: 1 },
            lastProcessedContentId: input.contentId,
            status: "running",
          },
        });
      }
    })
  );

  if (!input.retryable) {
    await finalizeCurriculumRegenerationRun(input.runId);
  }
}

export async function processCurriculumRegenerationLessonJob(payload: CurriculumRegenerationJobPayload) {
  if (!isCurriculumRegenQueueEnabled()) {
    throw new Error("ENABLE_CURRICULUM_REGEN_QUEUE must be true to process regeneration jobs.");
  }

  const job = await prisma.curriculumRegenerationJob.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });
  if (!job) throw new Error(`Regeneration job not found for ${payload.idempotencyKey}`);
  if (job.status === "approved" || job.status === "skipped") {
    await finalizeCurriculumRegenerationRun(job.runId);
    return { jobId: job.id, status: job.status, skipped: true };
  }

  const run = await prisma.curriculumRegenerationRun.findUnique({ where: { id: job.runId } });
  if (!run || run.status === "stopped" || run.status === "paused") {
    return { jobId: job.id, status: "skipped", skipped: true };
  }

  await withDbWriteThrottle("curriculum.regeneration.job.start", () =>
    prisma.$transaction(async (tx) => {
      await tx.curriculumRegenerationRun.update({
        where: { id: job.runId },
        data: {
          status: "running",
          startedAt: run.startedAt ?? new Date(),
          currentGradeLevel: job.gradeLevel,
          currentSubject: job.subject,
        },
      });
      await tx.curriculumRegenerationJob.update({
        where: { id: job.id },
        data: { status: "processing", attempt: { increment: 1 }, lastErrorCode: null, lastErrorMessage: null },
      });
      await tx.curriculumRegenerationCheckpoint.update({
        where: {
          runId_gradeLevel_subject: {
            runId: job.runId,
            gradeLevel: job.gradeLevel,
            subject: job.subject,
          },
        },
        data: { status: "running" },
      });
    })
  );

  await logAudit({
    userId: job.requestedBy ?? null,
    action: "curriculum.regeneration.job.started",
    resourceType: "curriculum_regeneration_job",
    resourceId: job.id,
    schoolId: job.schoolId ?? null,
    details: { runId: job.runId, curriculumContentId: job.curriculumContentId, gradeLevel: job.gradeLevel, subject: job.subject },
  });

  try {
    const lesson = await prisma.curriculumContent.findUnique({
      where: { contentId: job.curriculumContentId },
      select: { contentId: true, title: true, grade: true, subject: true, status: true, payload: true, moeAlignments: true },
    });
    if (!lesson || lesson.status !== "NEEDS_REVIEW") {
      await withDbWriteThrottle("curriculum.regeneration.job.skipped", () =>
        prisma.$transaction(async (tx) => {
          await tx.curriculumRegenerationJob.update({ where: { id: job.id }, data: { status: "skipped" } });
          await tx.curriculumRegenerationRun.update({
            where: { id: job.runId },
            data: { totalProcessed: { increment: 1 } },
          });
          await tx.curriculumRegenerationCheckpoint.update({
            where: {
              runId_gradeLevel_subject: {
                runId: job.runId,
                gradeLevel: job.gradeLevel,
                subject: job.subject,
              },
            },
            data: {
              processedCount: { increment: 1 },
              lastProcessedContentId: job.curriculumContentId,
              status: "running",
            },
          });
        })
      );
      await finalizeCurriculumRegenerationRun(job.runId);
      return { jobId: job.id, status: "skipped", skipped: true };
    }

    const topic = job.topic ?? inferTopic(lesson);
    const generated = await withProviderRetry(
      { provider: job.provider ?? undefined, operation: "curriculum.regenerate.lesson" },
      () =>
        generateCurriculumPayload({
          grade: lesson.grade,
          subject: lesson.subject,
          topic,
          contentType: "lesson",
          moeAlignmentCodes: alignmentCodes(lesson.moeAlignments),
          lessonFormat: "either",
          liberiaContext: true,
          forceSmartTier: true,
        })
    );
    const quality = validateRegeneratedLesson(generated);
    if (!quality.passed) {
      throw new NonRetryableProviderError(`quality_gate_failure:${quality.reason}`, "quality_gate_failure");
    }

    const depth = validateLessonDepth(generated, lesson.grade);
    if (!depth.valid) {
      const reason = depth.failReasons.join(";");
      // status is a no-op write, not a revert: this function requires
      // lesson.status === "NEEDS_REVIEW" as a precondition before it will
      // even start generating (see the check above), so it is already
      // NEEDS_REVIEW here. Nothing is being reverted or changed by this
      // write - only the payload's diagnostic fields below are new. Kept
      // explicit (rather than dropped) so the intended post-failure status
      // is unambiguous to a future reader, since there is no stored
      // prior-status field on CurriculumContent to fall back on.
      await prisma.curriculumContent.update({
        where: { contentId: job.curriculumContentId },
        data: {
          status: "NEEDS_REVIEW",
          payload: {
            ...((lesson.payload as Record<string, unknown>) ?? {}),
            depthValidationFailedAt: new Date().toISOString(),
            depthValidationReason: reason,
            depthValidationDetails: { slideCount: depth.slideCount, wordCount: depth.wordCount, hasForbidden: depth.hasForbidden },
          } as any,
        },
      });
      throw new NonRetryableProviderError(`depth_gate_failure:${reason}`, "quality_gate_failure");
    }

    const nextPayload = {
      ...generated,
      lessonContent: extractLessonText(generated),
      approvalStatus: "DRAFT",
      generationMetadata: {
        ...(typeof generated.metadata === "object" && generated.metadata ? generated.metadata : {}),
        regeneratedFromStatus: "NEEDS_REVIEW",
        regenerationRunId: job.runId,
        regenerationJobId: job.id,
        qualityPassed: true,
        qualityFailureReason: null,
        contentLength: quality.contentLength,
        depthSlideCount: depth.slideCount,
        depthWordCount: depth.wordCount,
        generatedAt: new Date().toISOString(),
      },
    };

    await withDbWriteThrottle(
      "curriculum.regeneration.lesson.persist",
      () =>
        prisma.$transaction(async (tx) => {
          await tx.curriculumContent.update({
            where: { contentId: job.curriculumContentId },
            data: {
              title: generated.title,
              status: "DRAFT",
              payload: nextPayload as any,
              hash: contentHash(nextPayload),
              updatedAt: new Date(),
            },
          });
          await tx.curriculumRegenerationJob.update({
            where: { id: job.id },
            data: { status: "approved", lastErrorCode: null, lastErrorMessage: null },
          });
          await tx.curriculumRegenerationRun.update({
            where: { id: job.runId },
            data: { totalProcessed: { increment: 1 }, totalApproved: { increment: 1 } },
          });
          await tx.curriculumRegenerationCheckpoint.update({
            where: {
              runId_gradeLevel_subject: {
                runId: job.runId,
                gradeLevel: job.gradeLevel,
                subject: job.subject,
              },
            },
            data: {
              processedCount: { increment: 1 },
              approvedCount: { increment: 1 },
              lastProcessedContentId: job.curriculumContentId,
              status: "running",
            },
          });
        }),
      { maxConcurrency: getSubjectConcurrencyProfile(job.subject).dbWriteConcurrency }
    );

    await logAudit({
      userId: job.requestedBy ?? null,
      action: "curriculum.regeneration.job.succeeded",
      resourceType: "curriculum_regeneration_job",
      resourceId: job.id,
      schoolId: job.schoolId ?? null,
      details: { runId: job.runId, curriculumContentId: job.curriculumContentId, status: "DRAFT", contentLength: quality.contentLength },
    });

    await finalizeCurriculumRegenerationRun(job.runId);

    return { jobId: job.id, status: "approved", contentId: job.curriculumContentId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nonRetryable = error instanceof NonRetryableProviderError;
    const nextAttempt = job.attempt + 1;
    const retryable = !nonRetryable && nextAttempt < job.maxAttempts;
    await markJobFailed({
      jobId: job.id,
      runId: job.runId,
      gradeLevel: job.gradeLevel,
      subject: job.subject,
      contentId: job.curriculumContentId,
      code: nonRetryable ? error.code : "generation_failed",
      message,
      retryable,
    });
    await logAudit({
      userId: job.requestedBy ?? null,
      action: "curriculum.regeneration.job.failed",
      resourceType: "curriculum_regeneration_job",
      resourceId: job.id,
      schoolId: job.schoolId ?? null,
      details: { runId: job.runId, curriculumContentId: job.curriculumContentId, retryable, error: message.slice(0, 500) },
    });
    if (retryable) {
      await enqueueJob(JobType.CURRICULUM_REGENERATE_LESSON, { ...payload, attempt: nextAttempt }, {
        messageGroupId: payload.runId,
        messageDeduplicationId: buildRetryDeduplicationId(payload.idempotencyKey, nextAttempt),
      });
    }
    return { jobId: job.id, status: retryable ? "pending" : "failed", error: message };
  }
}

export async function enqueuePendingCurriculumRegenerationJobs(input: CurriculumRegenerationGroupPayload) {
  if (!isCurriculumRegenQueueEnabled()) {
    throw new Error("ENABLE_CURRICULUM_REGEN_QUEUE must be true to enqueue regeneration jobs.");
  }
  const run = await prisma.curriculumRegenerationRun.findUnique({ where: { id: input.runId } });
  if (!run || run.status === "completed" || run.status === "completed_with_errors" || run.status === "stopped") {
    return { enqueued: 0, skipped: true };
  }

  await finalizeCurriculumRegenerationRun(input.runId);

  const refreshedRun = await prisma.curriculumRegenerationRun.findUnique({ where: { id: input.runId } });
  if (refreshedRun?.status === "completed" || refreshedRun?.status === "completed_with_errors") {
    return { enqueued: 0, skipped: true };
  }

  const jobs = await prisma.curriculumRegenerationJob.findMany({
    where: {
      runId: input.runId,
      gradeLevel: input.gradeLevel,
      subject: normalizeSubject(input.subject),
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
    take: getSubjectConcurrencyProfile(input.subject).batchSize,
  });
  for (const job of jobs) {
    const payload = {
      runId: job.runId,
      gradeLevel: job.gradeLevel,
      subject: job.subject,
      curriculumContentId: job.curriculumContentId,
      topic: job.topic,
      attempt: job.attempt,
      provider: job.provider,
      requestedBy: job.requestedBy,
      schoolId: job.schoolId,
      tenantId: job.tenantId,
      idempotencyKey: job.idempotencyKey,
    };
    await enqueueJob(JobType.CURRICULUM_REGENERATE_LESSON, payload, {
      messageGroupId: job.runId,
      messageDeduplicationId: buildRetryDeduplicationId(job.idempotencyKey, job.attempt),
    });
  }

  if (jobs.length === 0) {
    await finalizeCurriculumRegenerationRun(input.runId);
  }

  return { enqueued: jobs.length };
}

export async function stopCurriculumRegenerationRun(runId: string, reason: string) {
  await prisma.curriculumRegenerationRun.update({
    where: { id: runId },
    data: { status: "stopped", stoppedReason: reason, completedAt: new Date() },
  });
  await prisma.curriculumRegenerationJob.updateMany({
    where: { runId, status: { in: ["pending", "processing"] } },
    data: { status: "skipped", lastErrorCode: "run_stopped", lastErrorMessage: reason.slice(0, 2000) },
  });
}

export async function getCurriculumRegenerationStatus(runId: string) {
  const [run, checkpoints, jobs] = await Promise.all([
    prisma.curriculumRegenerationRun.findUnique({ where: { id: runId } }),
    prisma.curriculumRegenerationCheckpoint.findMany({ where: { runId }, orderBy: [{ gradeLevel: "asc" }, { subject: "asc" }] }),
    prisma.curriculumRegenerationJob.groupBy({ by: ["status"], where: { runId }, _count: { _all: true } }),
  ]);
  return { run, checkpoints, jobs };
}
