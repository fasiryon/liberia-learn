import { prisma } from "@/lib/db";
import {
  getTtsDailyBudgetUsd,
  getTtsMonthlyCapUsd,
  isTtsGenerationStopped,
} from "@/lib/serverFlags";

export type SubjectCostRow = {
  subject: string;
  totalCostUsd: number;
  lessonCount: number;
  avgCostPerLesson: number;
};

export type GradeCostRow = {
  grade: number;
  totalCostUsd: number;
  lessonCount: number;
};

export type TextbookSubjectRow = {
  subject: string;
  totalCostUsd: number;
  jobCount: number;
};

export type TextbookGradeRow = {
  grade: number;
  totalCostUsd: number;
  jobCount: number;
};

export type PipelineCostSummary = {
  audio: {
    totalCostUsd: number;
    todayCostUsd: number;
    monthCostUsd: number;
    lessonCount: number;
    avgCostPerLesson: number;
    bySubject: SubjectCostRow[];
    byGrade: GradeCostRow[];
  };
  textbooks: {
    totalCostUsd: number;
    jobCount: number;
    bySubject: TextbookSubjectRow[];
    byGrade: TextbookGradeRow[];
  };
  combinedTotalCostUsd: number;
  todayCostUsd: number;
  alerts: string[];
  ttsStopFlagActive: boolean;
  dailyCap: number;
  monthlyCap: number;
};

type RawSubjectRow = { subject: string; total_cost: number; lesson_count: bigint };
type RawGradeRow = { grade: number; total_cost: number; lesson_count: bigint };

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmt2(n: number) {
  return `$${n.toFixed(2)}`;
}

export async function getPipelineCostSummary(): Promise<PipelineCostSummary> {
  const today = startOfDay();
  const month = startOfMonth();
  const dailyCap = getTtsDailyBudgetUsd();
  const monthlyCap = getTtsMonthlyCapUsd();
  const stopFlagActive = isTtsGenerationStopped();

  const [
    audioBySubjectRows,
    audioByGradeRows,
    audioTodayAgg,
    audioMonthAgg,
    textbookGrouped,
  ] = await Promise.all([
    prisma.$queryRaw<RawSubjectRow[]>`
      SELECT c.subject,
             COALESCE(SUM(a."estimatedCostUsd"), 0)::float8 AS total_cost,
             COUNT(a.id) AS lesson_count
      FROM "LessonAudio" a
      JOIN "CurriculumContent" c ON a."lessonId" = c."contentId"
      WHERE a.status = 'GENERATED'
      GROUP BY c.subject
      ORDER BY total_cost DESC
    `,
    prisma.$queryRaw<RawGradeRow[]>`
      SELECT c.grade,
             COALESCE(SUM(a."estimatedCostUsd"), 0)::float8 AS total_cost,
             COUNT(a.id) AS lesson_count
      FROM "LessonAudio" a
      JOIN "CurriculumContent" c ON a."lessonId" = c."contentId"
      WHERE a.status = 'GENERATED'
      GROUP BY c.grade
      ORDER BY c.grade ASC
    `,
    prisma.lessonAudio.aggregate({
      where: { status: "GENERATED", generatedAt: { gte: today } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.lessonAudio.aggregate({
      where: { status: "GENERATED", generatedAt: { gte: month } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.textbookGenerationJob.groupBy({
      by: ["subject", "grade"],
      where: { status: "GENERATED" },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
  ]);

  const audioBySubject: SubjectCostRow[] = audioBySubjectRows.map((row) => {
    const cost = Number(row.total_cost);
    const count = Number(row.lesson_count);
    return {
      subject: row.subject,
      totalCostUsd: cost,
      lessonCount: count,
      avgCostPerLesson: count > 0 ? cost / count : 0,
    };
  });

  const audioByGrade: GradeCostRow[] = audioByGradeRows.map((row) => ({
    grade: row.grade,
    totalCostUsd: Number(row.total_cost),
    lessonCount: Number(row.lesson_count),
  }));

  const audioTotalCostUsd = audioBySubject.reduce((s, r) => s + r.totalCostUsd, 0);
  const audioTotalLessons = audioBySubject.reduce((s, r) => s + r.lessonCount, 0);
  const audioTodayCostUsd = Number(audioTodayAgg._sum.estimatedCostUsd ?? 0);
  const audioMonthCostUsd = Number(audioMonthAgg._sum.estimatedCostUsd ?? 0);

  const textbookBySubjectMap = new Map<string, { totalCostUsd: number; jobCount: number }>();
  const textbookByGradeMap = new Map<number, { totalCostUsd: number; jobCount: number }>();
  let textbookTotalCostUsd = 0;
  let textbookTotalJobs = 0;

  for (const row of textbookGrouped) {
    const cost = Number(row._sum.estimatedCostUsd ?? 0);
    const count = Number(row._count._all);
    textbookTotalCostUsd += cost;
    textbookTotalJobs += count;

    const sub = textbookBySubjectMap.get(row.subject) ?? { totalCostUsd: 0, jobCount: 0 };
    textbookBySubjectMap.set(row.subject, {
      totalCostUsd: sub.totalCostUsd + cost,
      jobCount: sub.jobCount + count,
    });
    const gr = textbookByGradeMap.get(row.grade) ?? { totalCostUsd: 0, jobCount: 0 };
    textbookByGradeMap.set(row.grade, {
      totalCostUsd: gr.totalCostUsd + cost,
      jobCount: gr.jobCount + count,
    });
  }

  const textbookBySubject: TextbookSubjectRow[] = Array.from(textbookBySubjectMap.entries())
    .map(([subject, d]) => ({ subject, ...d }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  const textbookByGrade: TextbookGradeRow[] = Array.from(textbookByGradeMap.entries())
    .map(([grade, d]) => ({ grade, ...d }))
    .sort((a, b) => a.grade - b.grade);

  const combinedTotalCostUsd = audioTotalCostUsd + textbookTotalCostUsd;
  const todayCostUsd = audioTodayCostUsd;

  const alerts: string[] = [];
  if (stopFlagActive) {
    alerts.push("TTS_STOP_GENERATION is active — no new audio jobs will be claimed.");
  }
  if (audioTodayCostUsd >= dailyCap) {
    alerts.push(
      `Audio TTS daily cap (${fmt2(dailyCap)}) reached — today spend is ${fmt2(audioTodayCostUsd)}.`
    );
  } else if (audioTodayCostUsd >= dailyCap * 0.8) {
    alerts.push(
      `Audio TTS spend today (${fmt2(audioTodayCostUsd)}) is at 80%+ of daily cap (${fmt2(dailyCap)}).`
    );
  }
  if (audioMonthCostUsd >= monthlyCap * 0.9) {
    alerts.push(
      `Monthly TTS spend (${fmt2(audioMonthCostUsd)}) is above 90% of monthly cap (${fmt2(monthlyCap)}).`
    );
  }

  return {
    audio: {
      totalCostUsd: audioTotalCostUsd,
      todayCostUsd: audioTodayCostUsd,
      monthCostUsd: audioMonthCostUsd,
      lessonCount: audioTotalLessons,
      avgCostPerLesson: audioTotalLessons > 0 ? audioTotalCostUsd / audioTotalLessons : 0,
      bySubject: audioBySubject,
      byGrade: audioByGrade,
    },
    textbooks: {
      totalCostUsd: textbookTotalCostUsd,
      jobCount: textbookTotalJobs,
      bySubject: textbookBySubject,
      byGrade: textbookByGrade,
    },
    combinedTotalCostUsd,
    todayCostUsd,
    alerts,
    ttsStopFlagActive: stopFlagActive,
    dailyCap,
    monthlyCap,
  };
}
