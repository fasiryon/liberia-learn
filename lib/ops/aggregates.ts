/**
 * lib/ops/aggregates.ts
 *
 * Computes ops-level aggregate metrics for the findings engine and admin UI.
 * ALL returned values are aggregate counts/rates — NO PII (no names, phones, IDs).
 *
 * Tenant isolation: all queries are scoped to schoolId when provided.
 * Offline-safe: queries are read-only; no side effects.
 */

import { prisma } from "@/lib/db";
import { MODULES_BY_LEVEL } from "@/lib/training/modules";

// ── Aggregate shapes ──────────────────────────────────────────────────────────

export interface OnboardingAggregates {
  totalCompleted: number;
  totalDismissed: number;
  totalReopened: number;
  completionRate: number; // 0–1
  abandonRate: number;   // 0–1
  windowHours: number;
}

export interface TrainingAggregates {
  totalTeachers: number;
  l1CompletionRate: number; // 0–1
  l2CompletionRate: number;
  l3CompletionRate: number;
  totalAbandoned: number;   // module + level abandoned events in window
  windowHours: number;
}

export interface SmsAggregates {
  sendCount: number;
  failedCount: number;
  failureRate: number;   // 0–1
  throttledCount: number;
  windowHours: number;
}

export interface OfflineAggregates {
  conflictCount: number;
  deadLetterCount: number;
  windowHours: number;
}

export interface OpsAggregates {
  onboarding: OnboardingAggregates;
  training: TrainingAggregates;
  sms: SmsAggregates;
  offline: OfflineAggregates;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Gather all ops aggregates for the findings engine.
 *
 * @param schoolId  Tenant scope. Pass null only for platform-admin global views.
 * @param windowHours  Look-back window (default 168 = 7 days).
 */
export async function getOpsAggregates(
  schoolId: string | null,
  windowHours = 168
): Promise<OpsAggregates> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const schoolFilter = schoolId ? { schoolId } : {};

  // ── 1. Batch MetricEvent query (all event names we care about) ─────────────
  const events = await prisma.metricEvent.findMany({
    where: {
      ...schoolFilter,
      createdAt: { gte: since },
      name: {
        in: [
          // onboarding
          "onboarding.dismissed",
          "onboarding.completed",
          "onboarding.reopened",
          // training abandon
          "training.module_abandoned",
          "training.level_abandoned",
          // SMS
          "sms.sent",
          "sms.failed",
          "sms.throttled",
          // offline
          "offline.sync_conflict_detected",
          "offline.queue.conflicts",
          "offline.queue_deadlettered",
          "offline.queue.dead_letter",
        ],
      },
    },
    select: { name: true, payloadJson: true },
  });

  // ── 2. Onboarding aggregates ───────────────────────────────────────────────
  const obCompleted = events.filter((e) => e.name === "onboarding.completed").length;
  const obDismissed = events.filter((e) => e.name === "onboarding.dismissed").length;
  const obReopened  = events.filter((e) => e.name === "onboarding.reopened").length;
  const obTotal     = obCompleted + obDismissed;

  const onboarding: OnboardingAggregates = {
    totalCompleted:  obCompleted,
    totalDismissed:  obDismissed,
    totalReopened:   obReopened,
    completionRate:  obTotal > 0 ? obCompleted / obTotal : 0,
    abandonRate:     obTotal > 0 ? obDismissed / obTotal : 0,
    windowHours,
  };

  // ── 3. Training aggregates (via TrainingProgress table) ────────────────────
  const training = await computeTrainingAggregates(schoolId, events, windowHours);

  // ── 4. SMS aggregates ──────────────────────────────────────────────────────
  const smsSent      = events.filter((e) => e.name === "sms.sent").length;
  const smsFailed    = events.filter((e) => e.name === "sms.failed").length;
  const smsThrottled = events.filter((e) => e.name === "sms.throttled").length;

  const sms: SmsAggregates = {
    sendCount:     smsSent,
    failedCount:   smsFailed,
    failureRate:   smsSent + smsFailed > 0 ? smsFailed / (smsSent + smsFailed) : 0,
    throttledCount: smsThrottled,
    windowHours,
  };

  // ── 5. Offline aggregates ──────────────────────────────────────────────────
  const numFromPayload = (e: { payloadJson: unknown }): number => {
    const p = e.payloadJson as Record<string, unknown> | null;
    const n = p?.count ?? p?.conflicts ?? 1;
    return typeof n === "number" ? n : 1;
  };

  const conflictCount = events
    .filter(
      (e) =>
        e.name === "offline.sync_conflict_detected" ||
        e.name === "offline.queue.conflicts"
    )
    .reduce((sum, e) => sum + numFromPayload(e), 0);

  const deadLetterCount = events
    .filter(
      (e) =>
        e.name === "offline.queue_deadlettered" ||
        e.name === "offline.queue.dead_letter"
    )
    .reduce((sum, e) => sum + numFromPayload(e), 0);

  const offline: OfflineAggregates = {
    conflictCount,
    deadLetterCount,
    windowHours,
  };

  return { onboarding, training, sms, offline };
}

// ── Training helper ───────────────────────────────────────────────────────────

async function computeTrainingAggregates(
  schoolId: string | null,
  events: Array<{ name: string; payloadJson: unknown }>,
  windowHours: number
): Promise<TrainingAggregates> {
  // Count total teachers for the school (or all teachers if global)
  const teacherFilter = schoolId
    ? { schoolId, role: "TEACHER" as const }
    : { role: "TEACHER" as const };

  const totalTeachers = await prisma.user.count({ where: teacherFilter });

  if (totalTeachers === 0) {
    return {
      totalTeachers: 0,
      l1CompletionRate: 0,
      l2CompletionRate: 0,
      l3CompletionRate: 0,
      totalAbandoned: 0,
      windowHours,
    };
  }

  // Fetch completed TrainingProgress records scoped to this school's teachers
  const progressWhere = schoolId
    ? { User: { schoolId }, status: "complete" as const }
    : { status: "complete" as const };

  const completedRecords = await prisma.trainingProgress.findMany({
    where: progressWhere,
    select: { teacherUserId: true, moduleId: true },
  });

  // Build per-teacher completion sets
  const byTeacher = new Map<string, Set<string>>();
  for (const r of completedRecords) {
    if (!byTeacher.has(r.teacherUserId)) byTeacher.set(r.teacherUserId, new Set());
    byTeacher.get(r.teacherUserId)!.add(r.moduleId);
  }

  const l1Ids = MODULES_BY_LEVEL[1].map((m) => m.id);
  const l2Ids = MODULES_BY_LEVEL[2].map((m) => m.id);
  const l3Ids = MODULES_BY_LEVEL[3].map((m) => m.id);

  let l1Complete = 0;
  let l2Complete = 0;
  let l3Complete = 0;

  for (const [, completed] of byTeacher) {
    if (l1Ids.every((id) => completed.has(id))) l1Complete++;
    if (l2Ids.every((id) => completed.has(id))) l2Complete++;
    if (l3Ids.every((id) => completed.has(id))) l3Complete++;
  }

  const totalAbandoned = events.filter(
    (e) =>
      e.name === "training.module_abandoned" ||
      e.name === "training.level_abandoned"
  ).length;

  return {
    totalTeachers,
    l1CompletionRate: l1Complete / totalTeachers,
    l2CompletionRate: l2Complete / totalTeachers,
    l3CompletionRate: l3Complete / totalTeachers,
    totalAbandoned,
    windowHours,
  };
}
