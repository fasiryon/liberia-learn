import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type JsonObject = Record<string, unknown>;

export type LearningEventVersionRefs = {
  curriculumVersion?: string | null;
  promptVersion?: string | null;
  assessmentVersion?: string | null;
  calculationVersion?: string | null;
};

export type LearningEventActor = {
  type?: string | null;
  id?: string | null;
  role?: string | null;
};

export type LearningEventTarget = {
  type?: string | null;
  id?: string | null;
};

export type LogLearningEventInput = {
  /** Optional stable operation id. Used by offline sync to make the event
   * itself the server-side idempotency record without a second table. */
  eventId?: string | null;
  workflowRunId?: string | null;
  workflowTraceId?: string | null;
  correlationId?: string | null;
  schoolId?: string | null;
  districtId?: string | null;
  classId?: string | null;
  userId?: string | null;
  studentId?: string | null;
  actor?: LearningEventActor | null;
  target?: LearningEventTarget | null;
  eventType: string;
  source?: string | null;
  status?: string | null;
  occurredAt?: Date | string | null;
  originalOccurredAt?: Date | string | null;
  syncReceivedAt?: Date | string | null;
  clientEventId?: string | null;
  dedupeKey?: string | null;
  replayOfEventId?: string | null;
  replaySequence?: number | null;
  isReplay?: boolean | null;
  contentId?: string | null;
  lessonId?: string | null;
  unitId?: string | null;
  termId?: string | null;
  subject?: string | null;
  grade?: number | null;
  versionRefs?: LearningEventVersionRefs | null;
  metadata?: JsonObject | null;
  qualityMarkers?: JsonObject | null;
};

function toDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function toJson(value?: JsonObject | null): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

export async function logLearningEvent(
  input: LogLearningEventInput,
  options?: { throwOnError?: boolean }
) {
  const learningEventModel = (prisma as typeof prisma & {
    learningEvent?: { create?: (args: unknown) => Promise<unknown> };
  }).learningEvent;

  if (!learningEventModel?.create) {
    return null;
  }

  try {
    return await learningEventModel.create({
      data: {
        id: input.eventId ?? undefined,
        workflowRunId: input.workflowRunId ?? null,
        workflowTraceId: input.workflowTraceId ?? null,
        correlationId: input.correlationId ?? null,
        schoolId: input.schoolId ?? null,
        districtId: input.districtId ?? null,
        classId: input.classId ?? null,
        userId: input.userId ?? null,
        studentId: input.studentId ?? null,
        actorType: input.actor?.type ?? null,
        actorId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        targetType: input.target?.type ?? null,
        targetId: input.target?.id ?? null,
        eventType: input.eventType,
        source: input.source ?? null,
        status: input.status ?? "accepted",
        occurredAt: toDate(input.occurredAt) ?? new Date(),
        originalOccurredAt: toDate(input.originalOccurredAt),
        syncReceivedAt: toDate(input.syncReceivedAt),
        clientEventId: input.clientEventId ?? null,
        dedupeKey: input.dedupeKey ?? null,
        replayOfEventId: input.replayOfEventId ?? null,
        replaySequence: input.replaySequence ?? null,
        isReplay: input.isReplay === true,
        contentId: input.contentId ?? null,
        lessonId: input.lessonId ?? null,
        unitId: input.unitId ?? null,
        termId: input.termId ?? null,
        subject: input.subject ?? null,
        grade: input.grade ?? null,
        curriculumVersion: input.versionRefs?.curriculumVersion ?? null,
        promptVersion: input.versionRefs?.promptVersion ?? null,
        assessmentVersion: input.versionRefs?.assessmentVersion ?? null,
        calculationVersion: input.versionRefs?.calculationVersion ?? null,
        metadata: toJson(input.metadata),
        qualityMarkers: toJson(input.qualityMarkers),
      },
    });
  } catch (error) {
    if (options?.throwOnError) {
      throw error;
    }
    return null;
  }
}
