import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type LessonModeBreakdown = {
  mode: "read" | "slides" | "listen";
  count: number;
  percentage: number;
};

export type MultimediaAnalytics = {
  period: { days: number; since: string };
  lessonModeUsage: LessonModeBreakdown[];
  studentEngagement: {
    activeLearners: number;
    totalEvents: number;
    lessonInteractions: number;
    quizSubmissions: number;
  };
  audioUsage: {
    playbackStarts: number;
    generated: number;
    pending: number;
    processing: number;
    failed: number;
    estimatedCostUsd: number;
  };
  videoUsage: {
    playbackStarts: number;
    uploaded: number;
    active: number;
  };
};

type RawModeRow = { mode: string | null; count: bigint | number };
type AudioStatusRow = {
  status: string;
  _count: { _all: number };
  _sum: { estimatedCostUsd: number | null };
};

function pct(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function normalizeCount(value: bigint | number | null | undefined) {
  return Number(value ?? 0);
}

function schoolFilterSql(schoolId: string | null) {
  return schoolId ? Prisma.sql`AND "schoolId" = ${schoolId}` : Prisma.empty;
}

export async function getMultimediaAnalytics(input: {
  days?: number;
  schoolId?: string | null;
}): Promise<MultimediaAnalytics> {
  const days = Math.min(365, Math.max(1, input.days ?? 30));
  const schoolId = input.schoolId ?? null;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const modeRows = await prisma.$queryRaw<RawModeRow[]>`
    SELECT COALESCE("metadata"->>'mode', 'read') AS mode, COUNT(*) AS count
    FROM "LearningEvent"
    WHERE "eventType" = 'LESSON_MODE_CHANGED'
      AND "occurredAt" >= ${since}
      ${schoolFilterSql(schoolId)}
    GROUP BY COALESCE("metadata"->>'mode', 'read')
  `;

  const eventWhere = {
    occurredAt: { gte: since },
    ...(schoolId ? { schoolId } : {}),
  };

  const [
    activeLearners,
    totalEvents,
    lessonInteractions,
    quizSubmissions,
    audioPlaybackStarts,
    videoPlaybackStarts,
    audioRows,
    videoUploaded,
    videoActive,
  ] = await Promise.all([
    prisma.learningEvent.findMany({
      where: eventWhere,
      distinct: ["userId"],
      select: { userId: true },
    }).then((rows) => rows.filter((row) => row.userId).length),
    prisma.learningEvent.count({ where: eventWhere }),
    prisma.learningEvent.count({
      where: {
        ...eventWhere,
        eventType: { in: ["LESSON_MODE_CHANGED", "AUDIO_PLAYBACK_STARTED", "VIDEO_PLAYBACK_STARTED", "lesson.quiz.generated", "lesson.quiz.submitted"] },
      },
    }),
    prisma.learningEvent.count({ where: { ...eventWhere, eventType: "lesson.quiz.submitted" } }),
    prisma.learningEvent.count({ where: { ...eventWhere, eventType: "AUDIO_PLAYBACK_STARTED" } }),
    prisma.learningEvent.count({ where: { ...eventWhere, eventType: "VIDEO_PLAYBACK_STARTED" } }),
    prisma.lessonAudio.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }).then((rows) => rows as AudioStatusRow[]).catch(() => [] as AudioStatusRow[]),
    prisma.lessonVideo.count({
      where: schoolId ? { teacher: { schoolId } } : {},
    }).catch(() => 0),
    prisma.lessonVideo.count({
      where: { isActive: true, ...(schoolId ? { teacher: { schoolId } } : {}) },
    }).catch(() => 0),
  ]);

  const modeCounts = new Map(modeRows.map((row) => [String(row.mode ?? "read"), normalizeCount(row.count)]));
  const modeTotal = Array.from(modeCounts.values()).reduce((sum, value) => sum + value, 0);
  const lessonModeUsage = (["read", "slides", "listen"] as const).map((mode) => {
    const count = modeCounts.get(mode) ?? 0;
    return { mode, count, percentage: pct(count, modeTotal) };
  });

  const audioStatus = new Map<string, AudioStatusRow>(
    audioRows.map((row): [string, AudioStatusRow] => [row.status, row])
  );
  const costTotal = audioRows.reduce<number>((sum, row) => sum + Number(row._sum.estimatedCostUsd ?? 0), 0);

  return {
    period: { days, since: since.toISOString() },
    lessonModeUsage,
    studentEngagement: {
      activeLearners,
      totalEvents,
      lessonInteractions,
      quizSubmissions,
    },
    audioUsage: {
      playbackStarts: audioPlaybackStarts,
      generated: audioStatus.get("GENERATED")?._count._all ?? 0,
      pending: audioStatus.get("PENDING")?._count._all ?? 0,
      processing: audioStatus.get("PROCESSING")?._count._all ?? 0,
      failed: audioStatus.get("FAILED")?._count._all ?? 0,
      estimatedCostUsd: Math.round(costTotal * 10000) / 10000,
    },
    videoUsage: {
      playbackStarts: videoPlaybackStarts,
      uploaded: videoUploaded,
      active: videoActive,
    },
  };
}
