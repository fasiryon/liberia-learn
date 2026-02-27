/**
 * lib/metrics/impact/interventionOutcomeResolver.ts
 *
 * Resolves pre/post intervention outcomes at SCHOOL scope only.
 * - Tenant-safe: queries hard-scoped to schoolId
 * - Idempotent: re-run yields same stored results unless inputs change
 * - No PII: aggregates only
 */

import type { PrismaClient } from "@prisma/client";
import { mean, computeEffectSize } from "./statRules";

const DAY_MS = 86_400_000;
const BASELINE_WINDOW_DAYS = 30;
const FOLLOWUP_WINDOW_DAYS = 30;

export type InterventionLogRecord = {
  id: string;
  tenantId: string;
  schoolId: string;
  generatedAt: Date;
  outcomeCheckedAt?: Date | null;
  outcomeDelta?: number | null;
  outcomeEffectSize?: number | null;
  outcomeBaselineStart?: Date | null;
  outcomeBaselineEnd?: Date | null;
  outcomeFollowupStart?: Date | null;
  outcomeFollowupEnd?: Date | null;
  outcomeBaselineCount?: number | null;
  outcomeFollowupCount?: number | null;
};

export type OutcomeResolutionResult = {
  updated: boolean;
  outcomeDelta: number | null;
  outcomeEffectSize: number | null;
  outcomeBaselineCount: number;
  outcomeFollowupCount: number;
  outcomeBaselineStart: Date;
  outcomeBaselineEnd: Date;
  outcomeFollowupStart: Date;
  outcomeFollowupEnd: Date;
};

type PrismaLike = Pick<PrismaClient, "studentMasteryProfile" | "interventionLog">;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return round4(a) === round4(b);
}

function sameDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

async function fetchWindowScores(params: {
  prisma: PrismaLike;
  schoolId: string;
  start: Date;
  end: Date;
}): Promise<{ scores: number[]; count: number; avgScore: number }> {
  const rows = await params.prisma.studentMasteryProfile.findMany({
    where: {
      lastAssessedAt: { gte: params.start, lte: params.end },
      student: { user: { schoolId: params.schoolId } },
    } as any,
    select: { currentScore: true },
  } as any);

  const scores = (rows as Array<{ currentScore: number }>).map((r) => r.currentScore);
  return {
    scores,
    count: scores.length,
    avgScore: mean(scores),
  };
}

/**
 * Resolve a single intervention outcome.
 * Caller provides the log record and prisma client.
 */
export async function resolveInterventionOutcome(params: {
  prisma: PrismaLike;
  log: InterventionLogRecord;
  now?: Date;
}): Promise<OutcomeResolutionResult> {
  const { prisma, log } = params;
  const now = params.now ?? new Date();

  const baselineEnd = log.generatedAt;
  const baselineStart = addDays(baselineEnd, -BASELINE_WINDOW_DAYS);
  const followupStart = baselineEnd;
  const followupEnd = addDays(followupStart, FOLLOWUP_WINDOW_DAYS);

  const [baseline, followup] = await Promise.all([
    fetchWindowScores({ prisma, schoolId: log.schoolId, start: baselineStart, end: baselineEnd }),
    fetchWindowScores({ prisma, schoolId: log.schoolId, start: followupStart, end: followupEnd }),
  ]);

  const outcomeDelta =
    baseline.count > 0 && followup.count > 0
      ? round4(followup.avgScore - baseline.avgScore)
      : null;

  const rawEffectSize = computeEffectSize(baseline.scores, followup.scores);
  const outcomeEffectSize = rawEffectSize === null ? null : round4(rawEffectSize);

  const unchanged =
    log.outcomeCheckedAt &&
    sameNumber(log.outcomeDelta, outcomeDelta) &&
    sameNumber(log.outcomeEffectSize, outcomeEffectSize) &&
    sameDate(log.outcomeBaselineStart, baselineStart) &&
    sameDate(log.outcomeBaselineEnd, baselineEnd) &&
    sameDate(log.outcomeFollowupStart, followupStart) &&
    sameDate(log.outcomeFollowupEnd, followupEnd) &&
    (log.outcomeBaselineCount ?? null) === baseline.count &&
    (log.outcomeFollowupCount ?? null) === followup.count;

  if (unchanged) {
    return {
      updated: false,
      outcomeDelta,
      outcomeEffectSize,
      outcomeBaselineCount: baseline.count,
      outcomeFollowupCount: followup.count,
      outcomeBaselineStart: baselineStart,
      outcomeBaselineEnd: baselineEnd,
      outcomeFollowupStart: followupStart,
      outcomeFollowupEnd: followupEnd,
    };
  }

  const updateResult = await prisma.interventionLog.updateMany({
    where: {
      id: log.id,
      tenantId: log.tenantId,
      schoolId: log.schoolId,
    },
    data: {
      outcomeCheckedAt: now,
      outcomeDelta,
      outcomeEffectSize,
      outcomeBaselineStart: baselineStart,
      outcomeBaselineEnd: baselineEnd,
      outcomeFollowupStart: followupStart,
      outcomeFollowupEnd: followupEnd,
      outcomeBaselineCount: baseline.count,
      outcomeFollowupCount: followup.count,
    },
  });

  return {
    updated: updateResult.count > 0,
    outcomeDelta,
    outcomeEffectSize,
    outcomeBaselineCount: baseline.count,
    outcomeFollowupCount: followup.count,
    outcomeBaselineStart: baselineStart,
    outcomeBaselineEnd: baselineEnd,
    outcomeFollowupStart: followupStart,
    outcomeFollowupEnd: followupEnd,
  };
}

/**
 * Batch resolver for scheduled job execution.
 */
export async function resolveInterventionOutcomesBatch(params: {
  prisma: PrismaLike;
  now?: Date;
  minAgeDays?: number;
  batchSize?: number;
}): Promise<{ scanned: number; resolved: number; skipped: number; cutoff: Date }> {
  const now = params.now ?? new Date();
  const minAgeDays = params.minAgeDays ?? FOLLOWUP_WINDOW_DAYS;
  const batchSize = params.batchSize ?? 250;
  const cutoff = addDays(now, -minAgeDays);

  const logs = await params.prisma.interventionLog.findMany({
    where: {
      generatedAt: { lte: cutoff },
      outcomeCheckedAt: null,
    },
    orderBy: { generatedAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      tenantId: true,
      schoolId: true,
      generatedAt: true,
      outcomeCheckedAt: true,
      outcomeDelta: true,
      outcomeEffectSize: true,
      outcomeBaselineStart: true,
      outcomeBaselineEnd: true,
      outcomeFollowupStart: true,
      outcomeFollowupEnd: true,
      outcomeBaselineCount: true,
      outcomeFollowupCount: true,
    },
  });

  let resolved = 0;
  let skipped = 0;

  for (const log of logs as InterventionLogRecord[]) {
    const result = await resolveInterventionOutcome({
      prisma: params.prisma,
      log,
      now,
    });
    if (result.updated) resolved += 1;
    else skipped += 1;
  }

  return { scanned: logs.length, resolved, skipped, cutoff };
}

