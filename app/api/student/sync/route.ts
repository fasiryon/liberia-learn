import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { resolveAttendance, resolveSubmission } from "@/lib/offline-sync/policies";
import { recordMetricEvent } from "@/lib/metrics/events";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import {
  OFFLINE_SYNC_PROTOCOL_VERSION,
  offlineOperationFingerprint,
  validateOfflineOperation,
  type OfflineOperation,
} from "@/lib/offline/syncProtocol";

type SyncItem = {
  protocolVersion?: number;
  operationId?: string;
  learnerId?: string | null;
  schoolId?: string | null;
  resourceType?: string;
  resourceId?: string;
  operationType?: string;
  contentId?: string | null;
  contentVersion?: string | null;
  contentHash?: string | null;
  manifestSequence?: { revision: number; governance: number } | null;
  clientCreatedAt?: string;
  baseServerVersion?: string | null;
  idempotencyKey?: string;
  dependencyIds?: string[];
  id?: string;
  opId?: string;
  entity?: string;
  scheduledWorkId?: string;
  completedAt?: string;
  clientUpdatedAt?: string;
  clientEventId?: string;
  originalTimestamp?: string;
  payload?: Record<string, unknown>;
};

function canonicalOperation(item: SyncItem): OfflineOperation | null {
  const entity = item.entity ??
    (item.resourceType === "lesson_progress" ? "studentProgress" :
      item.resourceType === "attendance" ? "attendance" :
        item.resourceType === "assignment_submission" ? "assignmentSubmission" :
          item.resourceType === "assessment_attempt" ? "assessmentAttempt" :
            item.resourceType === "lab_session" ? "labSession" : "submission");
  const payload = item.payload ?? {};
  const operationId = item.operationId ?? item.opId ?? item.id ?? null;
  const resourceId = item.resourceId ?? item.scheduledWorkId ??
    (typeof payload.assignmentId === "string" ? payload.assignmentId :
      typeof payload.homeworkId === "string" ? payload.homeworkId :
        typeof payload.sessionId === "string" ? payload.sessionId : operationId);
  const inferred = entity === "studentProgress"
    ? { resourceType: "lesson_progress", operationType: "progress.complete" }
    : entity === "attendance"
      ? { resourceType: "attendance", operationType: "attendance.mark" }
      : entity === "assignmentSubmission"
        ? { resourceType: "assignment_submission", operationType: "assignment.submit" }
        : entity === "assessmentAttempt"
          ? { resourceType: "assessment_attempt", operationType: "assessment_attempt.append" }
          : entity === "labSession"
            ? { resourceType: "lab_session", operationType: "lab_session.merge" }
            : { resourceType: "homework_submission", operationType: "homework.submit" };
  if (!operationId || !resourceId) return null;
  const candidate = {
    protocolVersion: item.protocolVersion ?? OFFLINE_SYNC_PROTOCOL_VERSION,
    operationId,
    learnerId: item.learnerId ?? null,
    schoolId: item.schoolId ?? null,
    resourceType: (item.resourceType ?? inferred.resourceType) as OfflineOperation["resourceType"],
    resourceId,
    contentId: item.contentId ?? (typeof payload.contentId === "string" ? payload.contentId : null),
    contentVersion: item.contentVersion ?? (typeof payload.contentVersion === "string" ? payload.contentVersion : null),
    contentHash: item.contentHash ?? (typeof payload.contentHash === "string" ? payload.contentHash : null),
    manifestSequence: item.manifestSequence ?? null,
    operationType: (item.operationType ?? inferred.operationType) as OfflineOperation["operationType"],
    payload,
    clientCreatedAt: item.clientCreatedAt ?? item.originalTimestamp ?? item.clientUpdatedAt ?? item.completedAt ?? new Date().toISOString(),
    baseServerVersion: item.baseServerVersion ?? null,
    idempotencyKey: item.idempotencyKey ?? operationId,
    dependencyIds: item.dependencyIds ?? [],
  };
  return validateOfflineOperation(candidate) ? candidate : null;
}

function toIso(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSyncIdentity(item: SyncItem) {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const clientEventId =
    typeof item.operationId === "string"
      ? item.operationId
      : typeof item.clientEventId === "string"
      ? item.clientEventId
      : typeof payload.clientEventId === "string"
        ? payload.clientEventId
        : typeof item.opId === "string"
          ? item.opId
          : typeof item.id === "string"
            ? item.id
            : null;
  const originalTimestamp =
    toIso(item.clientCreatedAt) ??
    toIso(item.originalTimestamp) ??
    toIso(typeof payload.originalTimestamp === "string" ? payload.originalTimestamp : null) ??
    toIso(item.clientUpdatedAt) ??
    toIso(item.completedAt);
  const dedupeKey =
    typeof item.idempotencyKey === "string"
      ? item.idempotencyKey
      : typeof item.operationId === "string"
        ? item.operationId
        : typeof item.opId === "string"
      ? item.opId
      : typeof item.id === "string"
        ? item.id
        : clientEventId;

  return {
    clientEventId,
    originalTimestamp,
    syncReceivedAt: new Date().toISOString(),
    dedupeKey,
  };
}

async function findReplaySourceEvent(input: {
  schoolId?: string | null;
  userId?: string | null;
  eventType: string;
  clientEventId?: string | null;
  dedupeKey?: string | null;
}) {
  const learningEventModel = (prisma as typeof prisma & {
    learningEvent?: { findFirst?: (args: unknown) => Promise<any> };
  }).learningEvent;

  if (!learningEventModel?.findFirst || (!input.clientEventId && !input.dedupeKey)) {
    return null;
  }

  return learningEventModel.findFirst({
    where: {
      schoolId: input.schoolId ?? null,
      userId: input.userId ?? null,
      eventType: input.eventType,
      OR: [
        input.clientEventId ? { clientEventId: input.clientEventId } : undefined,
        input.dedupeKey ? { dedupeKey: input.dedupeKey } : undefined,
      ].filter(Boolean),
    },
    orderBy: { createdAt: "desc" },
  });
}

async function assessContentTrust(operation: OfflineOperation | null) {
  if (!operation?.contentId) return { action: "allow" as const, status: "legacy" };
  const contentModel = (prisma as typeof prisma & {
    curriculumContent?: { findUnique?: (args: unknown) => Promise<any> };
  }).curriculumContent;
  if (!contentModel?.findUnique) return { action: "allow" as const, status: "unchecked" };
  const row = await contentModel.findUnique({
    where: { contentId: operation.contentId },
    select: {
      contentId: true,
      version: true,
      hash: true,
      status: true,
      provenance: { select: { lifecycleState: true } },
    },
  });
  if (!row) return { action: "reject" as const, status: "content_not_found" };
  if (operation.contentVersion && row.version !== operation.contentVersion) {
    return { action: "conflict" as const, status: "content_version_changed", serverState: { version: row.version } };
  }
  if (operation.contentHash && row.hash && row.hash !== operation.contentHash) {
    return { action: "conflict" as const, status: "content_hash_mismatch", serverState: { hash: row.hash } };
  }
  const revoked = row.provenance?.lifecycleState === "REVOKED" || !["published", "APPROVED"].includes(String(row.status));
  return { action: "allow" as const, status: revoked ? "revoked_at_sync" : "trusted" };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const requestBody = await req.json();
    const { items, queueStats, protocolVersion } = requestBody ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0 });
    }

    await recordMetricEvent(
      "sync.attempt",
      { count: items.length },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId ?? null,
        severity: "info",
        kind: "counter",
        userId: user.id,
      }
    );
    if (queueStats && typeof queueStats === "object") {
      const pending = Number((queueStats as any).pending ?? 0);
      const conflicts = Number((queueStats as any).conflicts ?? 0);
      const deadLetter = Number((queueStats as any).deadLetter ?? 0);
      await Promise.all([
        recordMetricEvent("offline.queue.pending", { count: pending }, { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId ?? null, kind: "gauge", userId: user.id }),
        recordMetricEvent("offline.queue.conflicts", { count: conflicts }, { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId ?? null, kind: "gauge", userId: user.id }),
        recordMetricEvent("offline.queue.dead_letter", { count: deadLetter }, { scope: "school", scopeId: user.schoolId ?? null, schoolId: user.schoolId ?? null, kind: "gauge", userId: user.id }),
      ]);
    }

    let synced = 0;
    let skipped = 0;

    const results: Array<{
      status: "synced" | "skipped" | "conflict" | "rejected";
      opId?: string;
      entity?: string;
      scheduledWorkId?: string;
      serverState?: unknown;
      clientState?: unknown;
      resolutionHint?: string;
    }> = [];

    for (const item of items as SyncItem[]) {
      const canonical = protocolVersion === OFFLINE_SYNC_PROTOCOL_VERSION || item?.protocolVersion !== undefined
        ? canonicalOperation(item)
        : null;
      if (protocolVersion !== undefined && protocolVersion !== OFFLINE_SYNC_PROTOCOL_VERSION) {
        skipped++;
        results.push({ status: "rejected", opId: item?.operationId ?? item?.opId ?? item?.id, resolutionHint: "incompatible_client_protocol" });
        continue;
      }
      if (protocolVersion === OFFLINE_SYNC_PROTOCOL_VERSION && !canonical) {
        skipped++;
        results.push({ status: "rejected", opId: item?.operationId ?? item?.opId ?? item?.id, resolutionHint: "malformed_offline_operation" });
        continue;
      }
      const {
        id,
        opId,
        entity: legacyEntity = "studentProgress",
        scheduledWorkId: legacyScheduledWorkId,
        completedAt: legacyCompletedAt,
        clientUpdatedAt: legacyClientUpdatedAt,
        payload,
      } = item ?? {};

      const opKey = opId ?? id;
      const syncIdentity = getSyncIdentity(item);
      const scheduledWorkId = legacyScheduledWorkId ?? canonical?.resourceId;
      const completedAt = legacyCompletedAt ?? (typeof payload?.completedAt === "string" ? payload.completedAt : canonical?.clientCreatedAt);
      const clientUpdatedAt = legacyClientUpdatedAt ?? (typeof payload?.clientUpdatedAt === "string" ? payload.clientUpdatedAt : canonical?.clientCreatedAt);
      const canonicalEntity = canonical?.resourceType === "lesson_progress"
        ? "studentProgress"
        : canonical?.resourceType === "attendance"
          ? "attendance"
          : canonical?.resourceType === "assignment_submission"
            ? "assignmentSubmission"
            : canonical?.resourceType === "assessment_attempt"
              ? "assessmentAttempt"
              : canonical?.resourceType === "lab_session"
                ? "labSession"
                : legacyEntity;
      const effectiveEntity = canonicalEntity;
      const entity = effectiveEntity;
      const acceptedEventType = effectiveEntity === "studentProgress"
        ? "offline.sync.student_progress.accepted"
        : effectiveEntity === "attendance"
          ? "offline.sync.attendance.accepted"
          : effectiveEntity === "submission"
            ? "offline.sync.submission.accepted"
            : `offline.sync.${effectiveEntity}.accepted`;
      const operationFingerprint = canonical ? offlineOperationFingerprint(canonical) : null;

      if (canonical?.learnerId && canonical.learnerId !== user.id) {
        skipped++;
        results.push({ status: "rejected", opId: opKey, entity: effectiveEntity, resolutionHint: "learner_identity_mismatch" });
        continue;
      }
      if (canonical && ["assignment_draft", "mastery_event", "simulation_state"].includes(canonical.resourceType)) {
        skipped++;
        results.push({ status: "rejected", opId: opKey, entity: effectiveEntity, resolutionHint: "offline_resource_not_supported" });
        continue;
      }

      const contentTrust = await assessContentTrust(canonical);
      if (contentTrust.action === "reject") {
        skipped++;
        results.push({ status: "rejected", opId: opKey, entity: effectiveEntity, resolutionHint: contentTrust.status });
        continue;
      }
      if (contentTrust.action === "conflict") {
        results.push({ status: "conflict", opId: opKey, entity: effectiveEntity, serverState: contentTrust.serverState, clientState: canonical?.payload, resolutionHint: contentTrust.status });
        continue;
      }

      const replayOf = await findReplaySourceEvent({
        schoolId: user.schoolId ?? null,
        userId: user.id,
        eventType: acceptedEventType,
        clientEventId: syncIdentity.clientEventId,
        dedupeKey: syncIdentity.dedupeKey,
      });
      if (replayOf) {
        const priorFingerprint = (replayOf.metadata as Record<string, unknown> | null | undefined)?.operationFingerprint;
        if (operationFingerprint && typeof priorFingerprint === "string" && priorFingerprint !== operationFingerprint) {
          skipped++;
          results.push({
            status: "rejected",
            opId: opKey,
            entity: effectiveEntity,
            resolutionHint: "idempotency_key_payload_mismatch",
          });
          continue;
        }
        skipped++;
        results.push({
          status: "rejected",
          opId: opKey,
          entity: effectiveEntity,
          resolutionHint: "replay_deduped",
        });
        continue;
      }

      try {
        if (effectiveEntity === "studentProgress") {
          if (!scheduledWorkId) {
            skipped++;
            results.push({ opId: opKey, entity, scheduledWorkId, status: "skipped" });
            continue;
          }

          const clientTime = clientUpdatedAt ?? completedAt;
          if (!clientTime) {
            skipped++;
            results.push({ opId: opKey, entity, scheduledWorkId, status: "skipped" });
            continue;
          }

          const scheduledWorkModel = (prisma as typeof prisma & {
            scheduledWork?: { findFirst?: (args: unknown) => Promise<any> };
          }).scheduledWork;
          const studentProfile = (prisma as typeof prisma & {
            student?: { findUnique?: (args: unknown) => Promise<any> };
          }).student;
          if (scheduledWorkModel?.findFirst && studentProfile?.findUnique) {
            const profile = await studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
            const scheduledWork = await scheduledWorkModel.findFirst({
              where: {
                id: scheduledWorkId,
                class: { schoolId: user.schoolId, enrollments: { some: { studentId: profile?.id ?? "__missing__" } } },
              },
              select: { id: true, contentId: true },
            });
            if (!profile || !scheduledWork || (canonical?.contentId && scheduledWork.contentId !== canonical.contentId)) {
              skipped++;
              results.push({ opId: opKey, entity, scheduledWorkId, status: "rejected", resolutionHint: "scheduled_work_tenant_or_content_mismatch" });
              continue;
            }
          }

          const replayOf = await findReplaySourceEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            eventType: "offline.sync.student_progress.accepted",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
          });
          if (replayOf) {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.replay_deduped",
              source: "/api/student/sync",
              status: "rejected",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              replayOfEventId: replayOf.id,
              isReplay: true,
              metadata: {
                entity,
                scheduledWorkId,
              },
            });
            skipped++;
            results.push({ opId: opKey, entity, scheduledWorkId, status: "rejected" });
            continue;
          }

          const existing = await prisma.studentProgress.findUnique({
            where: { studentId_scheduledWorkId: { studentId: user.id, scheduledWorkId } },
          });

          if (existing?.completedAt && existing.completedAt.getTime() > new Date(clientTime).getTime()) {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.conflict",
              source: "/api/student/sync",
              status: "conflict",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              metadata: {
                entity,
                scheduledWorkId,
                resolutionHint: "student_progress_last_write_wins_by_timestamp",
              },
            });
            results.push({
              status: "conflict",
              opId: opKey,
              entity,
              scheduledWorkId,
              serverState: {
                scheduledWorkId,
                completedAt: existing.completedAt,
              },
              clientState: { scheduledWorkId, completedAt: clientTime },
              resolutionHint: "student_progress_last_write_wins_by_timestamp",
            });
            continue;
          }

          await prisma.studentProgress.upsert({
            where: { studentId_scheduledWorkId: { studentId: user.id, scheduledWorkId } },
            create: {
              studentId: user.id,
              scheduledWorkId,
              startedAt: new Date(clientTime),
              completedAt: new Date(clientTime),
              exitTicketResponses: payload?.exitTicketAnswers as any,
            },
            update: {
              completedAt: new Date(clientTime),
              ...(payload?.exitTicketAnswers !== undefined ? { exitTicketResponses: payload.exitTicketAnswers as any } : {}),
            },
          });
          synced++;
          await logLearningEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "studentProgress", id: scheduledWorkId },
            eventId: syncIdentity.clientEventId,
            eventType: "offline.sync.student_progress.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: {
              entity,
              scheduledWorkId,
              operationFingerprint,
            },
          });
          results.push({ opId: opKey, entity, scheduledWorkId, status: "synced" });
          continue;
        }

        if (effectiveEntity === "attendance") {
          const attendance = (payload ?? {}) as Record<string, unknown>;
          const meetingId =
            typeof attendance.meetingId === "string" ? attendance.meetingId : null;
          const attendanceStudentId =
            typeof attendance.studentId === "string" ? attendance.studentId : null;
          const status =
            typeof attendance.status === "string" ? attendance.status : null;
          const clientTime =
            typeof attendance.clientUpdatedAt === "string"
              ? attendance.clientUpdatedAt
              : clientUpdatedAt;

          if (!meetingId || !attendanceStudentId || !status || !clientTime) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
            continue;
          }

          const ownedStudent = await prisma.student.findUnique({
            where: { userId: user.id },
            select: { id: true },
          });
          if (!ownedStudent || ownedStudent.id !== attendanceStudentId) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "attendance_student_mismatch" });
            continue;
          }
          const meetingModel = (prisma as typeof prisma & {
            meeting?: { findUnique?: (args: unknown) => Promise<any> };
          }).meeting;
          if (meetingModel?.findUnique) {
            const meeting = await meetingModel.findUnique({
              where: { id: meetingId },
              select: { Class: { select: { schoolId: true } } },
            });
            if (!meeting || meeting.Class?.schoolId !== user.schoolId) {
              skipped++;
              results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "attendance_tenant_mismatch" });
              continue;
            }
          }

          const replayOf = await findReplaySourceEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            eventType: "offline.sync.attendance.accepted",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
          });
          if (replayOf) {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.replay_deduped",
              source: "/api/student/sync",
              status: "rejected",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              replayOfEventId: replayOf.id,
              isReplay: true,
              metadata: { entity, meetingId },
            });
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected" });
            continue;
          }

          const existing = await prisma.attendanceRecord.findUnique({
            where: { meetingId_studentId: { meetingId, studentId: attendanceStudentId } },
          });

          const resolution = resolveAttendance(
            existing
              ? {
                  meetingId,
                  studentId: attendanceStudentId,
                  status: existing.status as any,
                  markedAt: existing.markedAt,
                }
              : null,
            {
              meetingId,
              studentId: attendanceStudentId,
              status: status as any,
              clientUpdatedAt: clientTime,
            }
          );

          if (resolution.action === "conflict") {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.conflict",
              source: "/api/student/sync",
              status: "conflict",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              metadata: {
                entity,
                meetingId,
                resolutionHint: resolution.hint,
              },
            });
            results.push({
              status: "conflict",
              opId: opKey,
              entity,
              serverState: existing,
              clientState: attendance,
              resolutionHint: resolution.hint,
            });
            continue;
          }

          await prisma.attendanceRecord.upsert({
            where: { meetingId_studentId: { meetingId, studentId: attendanceStudentId } },
            update: { status: status as any, markedAt: resolution.markedAt },
            create: {
              meetingId,
              studentId: attendanceStudentId,
              status: status as any,
              markedAt: resolution.markedAt,
            },
          });
          synced++;
          await logLearningEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "attendance", id: meetingId },
            eventId: syncIdentity.clientEventId,
            eventType: "offline.sync.attendance.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, meetingId, studentId: attendanceStudentId, operationFingerprint },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (effectiveEntity === "assignmentSubmission") {
          const assignmentId = typeof payload?.assignmentId === "string" ? payload.assignmentId : canonical?.resourceId;
          const content = typeof payload?.content === "string" ? payload.content.trim() : "";
          if (!assignmentId || !content) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "invalid_assignment_submission" });
            continue;
          }
          const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
          const assignmentModel = (prisma as typeof prisma & { assignment?: { findUnique?: (args: unknown) => Promise<any> } }).assignment;
          if (!student || !assignmentModel?.findUnique) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "assignment_context_unavailable" });
            continue;
          }
          const assignment = await assignmentModel.findUnique({
            where: { id: assignmentId },
            select: { id: true, classId: true, Class: { select: { schoolId: true } } },
          });
          if (!assignment || assignment.Class?.schoolId !== user.schoolId) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "assignment_tenant_mismatch" });
            continue;
          }
          const enrollmentModel = (prisma as typeof prisma & { enrollment?: { findUnique?: (args: unknown) => Promise<any> } }).enrollment;
          const enrollment = enrollmentModel?.findUnique
            ? await enrollmentModel.findUnique({ where: { studentId_classId: { studentId: student.id, classId: assignment.classId } } })
            : null;
          if (!enrollment) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "assignment_enrollment_required" });
            continue;
          }
          const existing = await prisma.assignmentSubmission.findUnique({
            where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
          });
          if (existing && (existing.score != null || existing.gradedAt != null)) {
            results.push({ status: "conflict", opId: opKey, entity, serverState: existing, clientState: payload, resolutionHint: "assignment_graded_server_wins" });
            continue;
          }
          const clientTime = canonical?.clientCreatedAt ?? (typeof payload?.clientUpdatedAt === "string" ? payload.clientUpdatedAt : new Date().toISOString());
          await prisma.assignmentSubmission.upsert({
            where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
            create: { assignmentId, studentId: student.id, content, turnedInAt: new Date(clientTime) },
            update: { content, turnedInAt: new Date(clientTime) },
          });
          synced++;
          await logLearningEvent({
            eventId: syncIdentity.clientEventId,
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "assignment_submission", id: assignmentId },
            eventType: acceptedEventType,
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, assignmentId, operationFingerprint, contentTrust: contentTrust.status },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (effectiveEntity === "assessmentAttempt") {
          const quizId = typeof payload?.quizId === "string" ? payload.quizId : canonical?.resourceId;
          const answers = payload?.answers;
          if (!quizId || !Array.isArray(answers)) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "invalid_assessment_attempt" });
            continue;
          }
          const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
          const attemptModel = (prisma as typeof prisma & { assessmentAttempt?: { create?: (args: unknown) => Promise<any> } }).assessmentAttempt;
          if (!student || !attemptModel?.create) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "assessment_context_unavailable" });
            continue;
          }
          await attemptModel.create({
            data: {
              id: syncIdentity.clientEventId,
              assessmentId: quizId,
              studentId: student.id,
              userId: user.id,
              schoolId: user.schoolId ?? null,
              status: "offline_pending_review",
              score: null,
              rawResponse: { answers },
              metadata: { contentId: canonical?.contentId ?? null, contentVersion: canonical?.contentVersion ?? null, contentTrust: contentTrust.status },
              source: "offline.sync",
              attemptedAt: new Date(canonical?.clientCreatedAt ?? new Date().toISOString()),
              submittedAt: new Date(canonical?.clientCreatedAt ?? new Date().toISOString()),
            },
          });
          synced++;
          await logLearningEvent({
            eventId: syncIdentity.clientEventId,
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "assessment_attempt", id: syncIdentity.clientEventId },
            eventType: acceptedEventType,
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, quizId, operationFingerprint, contentTrust: contentTrust.status },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (effectiveEntity === "labSession") {
          const sessionId = canonical?.resourceId ?? (typeof payload?.sessionId === "string" ? payload.sessionId : null);
          if (!sessionId) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "invalid_lab_session" });
            continue;
          }
          const labModel = (prisma as typeof prisma & { labSession?: { findUnique?: (args: unknown) => Promise<any>; update?: (args: unknown) => Promise<any> } }).labSession;
          const session = await labModel?.findUnique?.({ where: { id: sessionId } });
          if (!session || session.studentId !== user.id || session.schoolId !== user.schoolId) {
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "lab_session_tenant_mismatch" });
            continue;
          }
          if (session.completedAt && payload?.completedAt) {
            results.push({ status: "conflict", opId: opKey, entity, serverState: session, clientState: payload, resolutionHint: "completed_lab_session_requires_review" });
            continue;
          }
          await labModel?.update?.({
            where: { id: sessionId },
            data: {
              observations: payload?.observations,
              conclusions: payload?.conclusions,
              score: typeof payload?.score === "number" ? payload.score : undefined,
              completedAt: typeof payload?.completedAt === "string" ? new Date(payload.completedAt) : undefined,
            },
          });
          synced++;
          await logLearningEvent({
            eventId: syncIdentity.clientEventId,
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "lab_session", id: sessionId },
            eventType: acceptedEventType,
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, sessionId, operationFingerprint, contentTrust: contentTrust.status },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (effectiveEntity === "submission") {
          const submission = (payload ?? {}) as Record<string, unknown>;
          const homeworkId =
            typeof submission.homeworkId === "string" ? submission.homeworkId : null;
          const answers = (submission.answers ?? null) as any;
          const clientTime =
            typeof submission.clientUpdatedAt === "string"
              ? submission.clientUpdatedAt
              : clientUpdatedAt;

          if (!homeworkId || !clientTime) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
            continue;
          }

          const homeworkModel = (prisma as typeof prisma & {
            homework?: { findFirst?: (args: unknown) => Promise<any> };
          }).homework;
          const studentModel = (prisma as typeof prisma & {
            student?: { findUnique?: (args: unknown) => Promise<any> };
          }).student;
          if (homeworkModel?.findFirst && studentModel?.findUnique) {
            const profile = await studentModel.findUnique({ where: { userId: user.id }, select: { id: true } });
            const homework = await homeworkModel.findFirst({
              where: {
                id: homeworkId,
                Class: { schoolId: user.schoolId, enrollments: { some: { studentId: profile?.id ?? "__missing__" } } },
              },
              select: { id: true },
            });
            if (!profile || !homework) {
              skipped++;
              results.push({ opId: opKey, entity, status: "rejected", resolutionHint: "homework_tenant_or_enrollment_mismatch" });
              continue;
            }
          }

          const replayOf = await findReplaySourceEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            eventType: "offline.sync.submission.accepted",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
          });
          if (replayOf) {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.replay_deduped",
              source: "/api/student/sync",
              status: "rejected",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              replayOfEventId: replayOf.id,
              isReplay: true,
              metadata: { entity, homeworkId },
            });
            skipped++;
            results.push({ opId: opKey, entity, status: "rejected" });
            continue;
          }

          const existing = await prisma.homeworkSubmission.findUnique({
            where: { homeworkId_studentId: { homeworkId, studentId: user.id } },
          });

          const resolution = resolveSubmission(
            existing
              ? {
                  homeworkId,
                  submittedAt: existing.submittedAt,
                  teacherScore: existing.teacherScore ?? null,
                  aiReviewed: existing.aiReviewed ?? false,
                }
              : null,
            { homeworkId, answers, clientUpdatedAt: clientTime }
          );

          if (resolution.action === "conflict") {
            await logLearningEvent({
              schoolId: user.schoolId ?? null,
              userId: user.id,
              studentId: user.id,
              actor: { type: "user", id: user.id, role: "STUDENT" },
              eventType: "offline.sync.conflict",
              source: "/api/student/sync",
              status: "conflict",
              clientEventId: syncIdentity.clientEventId,
              dedupeKey: syncIdentity.dedupeKey,
              originalOccurredAt: syncIdentity.originalTimestamp,
              syncReceivedAt: syncIdentity.syncReceivedAt,
              metadata: {
                entity,
                homeworkId,
                resolutionHint: resolution.hint,
              },
            });
            results.push({
              status: "conflict",
              opId: opKey,
              entity,
              serverState: existing,
              clientState: submission,
              resolutionHint: resolution.hint,
            });
            continue;
          }

          await prisma.homeworkSubmission.upsert({
            where: { homeworkId_studentId: { homeworkId, studentId: user.id } },
            update: { answers, submittedAt: resolution.submittedAt },
            create: { homeworkId, studentId: user.id, answers, submittedAt: resolution.submittedAt },
          });
          synced++;
          await logLearningEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "submission", id: homeworkId },
            eventId: syncIdentity.clientEventId,
            eventType: "offline.sync.submission.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, homeworkId, operationFingerprint },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        skipped++;
        results.push({ opId: opKey, entity, status: "skipped" });
      } catch (error: any) {
        // Do not turn a server-side failure into a false acknowledgement. The
        // client keeps this operation for bounded retry, while a duplicate
        // event is still resolved by the replay lookup on the next request.
        skipped++;
        results.push({
          opId: opKey,
          entity,
          status: "rejected",
          resolutionHint: error?.code === "P2002" ? "concurrent_duplicate_retry" : "retryable_server_failure",
        });
      }
    }

    await logAudit({
      userId: user.id,
      action: "offline.sync",
      resourceType: "studentProgress",
      details: { synced, skipped } as any,
    });

    const conflicts = results.filter((r) => r.status === "conflict").length;
    await recordMetricEvent(
      "sync.result",
      { synced, skipped, conflicts, processed: items.length },
      {
        scope: "school",
        scopeId: user.schoolId ?? null,
        schoolId: user.schoolId ?? null,
        severity: conflicts > 0 ? "warning" : "info",
        kind: "counter",
        userId: user.id,
      }
    );

    return NextResponse.json({ synced, skipped, results });
  } catch (err: any) {
    try {
      await recordMetricEvent(
        "sync.failure",
        { error: err?.message ?? "unknown" },
        {
          scope: "school",
          scopeId: null,
          schoolId: null,
          severity: "error",
          kind: "counter",
        }
      );
    } catch {
      // Never fail request because metrics write failed.
    }
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
