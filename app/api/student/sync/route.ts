import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { resolveAttendance, resolveSubmission } from "@/lib/offline-sync/policies";
import { recordMetricEvent } from "@/lib/metrics/events";
import { processEvidence } from "@/lib/mastery/evidencePipeline";

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
      status: "synced" | "skipped" | "conflict";
      opId?: string;
      entity?: string;
      scheduledWorkId?: string;
      serverState?: unknown;
      clientState?: unknown;
      resolutionHint?: string;
    }> = [];

    for (const item of items) {
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

          const existing = await prisma.studentProgress.findUnique({
            where: { studentId_scheduledWorkId: { studentId: user.id, scheduledWorkId } },
          });

          if (existing?.completedAt && existing.completedAt.getTime() > new Date(clientTime).getTime()) {
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
          results.push({ opId: opKey, entity, scheduledWorkId, status: "synced" });
          continue;
        }

        if (entity === "attendance") {
          const attendance = payload ?? {};
          const { meetingId, studentId, status } = attendance;
          const clientTime = attendance.clientUpdatedAt ?? clientUpdatedAt;

          if (!meetingId || !studentId || !status || !clientTime) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
            continue;
          }

          const existing = await prisma.attendanceRecord.findUnique({
            where: { meetingId_studentId: { meetingId, studentId } },
          });

          const resolution = resolveAttendance(
            existing
              ? { meetingId, studentId, status: existing.status as any, markedAt: existing.markedAt }
              : null,
            { meetingId, studentId, status, clientUpdatedAt: clientTime }
          );

          if (resolution.action === "conflict") {
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
            where: { meetingId_studentId: { meetingId, studentId } },
            update: { status, markedAt: resolution.markedAt },
            create: { meetingId, studentId, status, markedAt: resolution.markedAt },
          });
          synced++;
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (entity === "submission") {
          const submission = payload ?? {};
          const { homeworkId, answers } = submission;
          const clientTime = submission.clientUpdatedAt ?? clientUpdatedAt;

          if (!homeworkId || !clientTime) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
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
          results.push({ opId: opKey, entity, status: "synced" });
          continue;
        }

        if (entity === "evidence") {
          const ep = (payload ?? {}) as any;
          const { subject, strandKey, correct, total, difficulty, source, wasAiAssisted, timeSpentSec } = ep;
          const idempotencyKey = (item as any).idempotencyKey ?? opKey;
          const timestamp = completedAt ? new Date(completedAt) : new Date();

          if (!subject || !strandKey || typeof correct !== "number" ||
              typeof total !== "number" || !source) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
            continue;
          }

          const result = await processEvidence({
            schoolId: user.schoolId ?? "",
            studentId: user.id,
            subject,
            strandKey,
            correct,
            total,
            difficulty: typeof difficulty === "number" ? difficulty as 1 | 2 | 3 | 4 | 5 : undefined,
            source,
            wasAiAssisted: typeof wasAiAssisted === "boolean" ? wasAiAssisted : false,
            timeSpentSec: typeof timeSpentSec === "number" ? timeSpentSec : undefined,
            idempotencyKey,
            timestamp,
          });

          if (result.idempotent) {
            skipped++;
            results.push({ opId: opKey, entity, status: "skipped" });
          } else {
            synced++;
            results.push({ opId: opKey, entity, status: "synced" });
          }
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
