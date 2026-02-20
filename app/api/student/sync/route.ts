import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { resolveAttendance, resolveSubmission } from "@/lib/offline-sync/policies";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0 });
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

    return NextResponse.json({ synced, skipped, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
