import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { resolveAttendance, resolveSubmission } from "@/lib/offline-sync/policies";
import { recordMetricEvent } from "@/lib/metrics/events";
import { logLearningEvent } from "@/lib/events/logLearningEvent";

type SyncItem = {
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

function toIso(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getSyncIdentity(item: SyncItem) {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const clientEventId =
    typeof item.clientEventId === "string"
      ? item.clientEventId
      : typeof payload.clientEventId === "string"
        ? payload.clientEventId
        : typeof item.opId === "string"
          ? item.opId
          : typeof item.id === "string"
            ? item.id
            : null;
  const originalTimestamp =
    toIso(item.originalTimestamp) ??
    toIso(typeof payload.originalTimestamp === "string" ? payload.originalTimestamp : null) ??
    toIso(item.clientUpdatedAt) ??
    toIso(item.completedAt);
  const dedupeKey =
    typeof item.opId === "string"
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

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const { items, queueStats } = await req.json();

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
      const {
        id,
        opId,
        entity = "studentProgress",
        scheduledWorkId,
        completedAt,
        clientUpdatedAt,
        payload,
      } = item ?? {};

      const opKey = opId ?? id;
      const syncIdentity = getSyncIdentity(item);

      try {
        if (entity === "studentProgress") {
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
            },
            update: {
              completedAt: new Date(clientTime),
            },
          });
          synced++;
          await logLearningEvent({
            schoolId: user.schoolId ?? null,
            userId: user.id,
            studentId: user.id,
            actor: { type: "user", id: user.id, role: "STUDENT" },
            target: { type: "studentProgress", id: scheduledWorkId },
            eventType: "offline.sync.student_progress.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: {
              entity,
              scheduledWorkId,
            },
          });
          results.push({ opId: opKey, entity, scheduledWorkId, status: "synced" });
          continue;
        }

        if (entity === "attendance") {
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
            eventType: "offline.sync.attendance.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, meetingId, studentId: attendanceStudentId },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (entity === "submission") {
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
            eventType: "offline.sync.submission.accepted",
            source: "/api/student/sync",
            clientEventId: syncIdentity.clientEventId,
            dedupeKey: syncIdentity.dedupeKey,
            originalOccurredAt: syncIdentity.originalTimestamp,
            syncReceivedAt: syncIdentity.syncReceivedAt,
            metadata: { entity, homeworkId },
          });
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        skipped++;
        results.push({ opId: opKey, entity, status: "skipped" });
      } catch {
        skipped++;
        results.push({ opId: opKey, entity, status: "skipped" });
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
