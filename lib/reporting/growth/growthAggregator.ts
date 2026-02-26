import type { Subject } from "@prisma/client";
import {
  listSchoolSnapshotsForPeriod,
  startOfMonthUtc,
} from "@/lib/metrics/longitudinal/growthRepo";

type Classification = "on_track" | "at_risk" | "accelerating";

export type SchoolGrowthSummary = {
  periodStart: string;
  sampleSize: number;
  bySubject: Array<{
    subject: Subject;
    sampleSize: number;
    avgScore: number;
    avgGrowthRate: number;
    classificationCounts: Record<Classification, number>;
  }>;
  classificationCounts: Record<Classification, number>;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyCounts(): Record<Classification, number> {
  return {
    on_track: 0,
    at_risk: 0,
    accelerating: 0,
  };
}

export async function computeSchoolGrowthSummary(params: {
  tenantId: string;
  schoolId: string;
  periodStart?: Date;
}): Promise<SchoolGrowthSummary> {
  const periodStart = startOfMonthUtc(params.periodStart ?? new Date());

  const snapshots = await listSchoolSnapshotsForPeriod({
    tenantId: params.tenantId,
    schoolId: params.schoolId,
    periodStart,
  });

  if (snapshots.length === 0) {
    return {
      periodStart: periodStart.toISOString(),
      sampleSize: 0,
      bySubject: [],
      classificationCounts: emptyCounts(),
    };
  }

  const bySubject = new Map<
    Subject,
    {
      subject: Subject;
      sampleSize: number;
      scoreSum: number;
      growthRateSum: number;
      classificationCounts: Record<Classification, number>;
    }
  >();

  const totals = emptyCounts();

  for (const row of snapshots) {
    const subjectKey = row.subject as Subject;
    const existing =
      bySubject.get(subjectKey) ?? {
        subject: subjectKey,
        sampleSize: 0,
        scoreSum: 0,
        growthRateSum: 0,
        classificationCounts: emptyCounts(),
      };

    existing.sampleSize += 1;
    existing.scoreSum += row.score;
    existing.growthRateSum += row.growthRate;

    const cls = row.classification as Classification;
    if (cls in existing.classificationCounts) {
      existing.classificationCounts[cls] += 1;
      totals[cls] += 1;
    }

    bySubject.set(subjectKey, existing);
  }

  return {
    periodStart: periodStart.toISOString(),
    sampleSize: snapshots.length,
    bySubject: Array.from(bySubject.values())
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .map((row) => ({
        subject: row.subject,
        sampleSize: row.sampleSize,
        avgScore: round2(row.scoreSum / row.sampleSize),
        avgGrowthRate: round2(row.growthRateSum / row.sampleSize),
        classificationCounts: row.classificationCounts,
      })),
    classificationCounts: totals,
  };
}
