import { prisma } from "@/lib/db";
import { recordMetricEvent } from "@/lib/metrics/events";
import type { Subject } from "@prisma/client";
import {
  startOfMonthUtc,
  findPreviousSnapshot,
  upsertMonthlySnapshot,
} from "@/lib/metrics/longitudinal/growthRepo";

export type GrowthClassification = "on_track" | "at_risk" | "accelerating";

export function classifyGrowthRate(growthRate: number): GrowthClassification {
  if (growthRate < -5) return "at_risk";
  if (growthRate > 5) return "accelerating";
  return "on_track";
}

export function computeGrowthRatePercent(currentScore: number, previousScore: number | null): number {
  if (previousScore === null || !Number.isFinite(previousScore)) return 0;
  return Math.round((currentScore - previousScore) * 10000) / 100;
}

export function deriveGrowthSnapshot(currentScore: number, previousScore: number | null): {
  growthRate: number;
  classification: GrowthClassification;
} {
  const growthRate = computeGrowthRatePercent(currentScore, previousScore);
  return {
    growthRate,
    classification: classifyGrowthRate(growthRate),
  };
}

export async function captureMonthlySnapshotsForStudents(params: {
  tenantId: string;
  schoolId: string;
  studentIds: string[];
  periodStart?: Date;
}): Promise<{ snapshotsWritten: number; sampleSize: number }> {
  const { tenantId, schoolId, studentIds } = params;
  if (studentIds.length === 0) {
    return { snapshotsWritten: 0, sampleSize: 0 };
  }

  const periodStart = startOfMonthUtc(params.periodStart ?? new Date());

  const profiles = await prisma.studentMasteryProfile.findMany({
    where: {
      studentId: { in: studentIds },
      student: {
        user: {
          schoolId,
        },
      },
    },
    select: {
      studentId: true,
      subject: true,
      strandKey: true,
      currentScore: true,
    },
  });

  for (const profile of profiles) {
    const previous = await findPreviousSnapshot({
      tenantId,
      schoolId,
      studentId: profile.studentId,
      subject: profile.subject as Subject,
      strandKey: profile.strandKey,
      periodStart,
    });

    const { growthRate, classification } = deriveGrowthSnapshot(
      profile.currentScore,
      previous?.score ?? null
    );

    await upsertMonthlySnapshot({
      tenantId,
      schoolId,
      studentId: profile.studentId,
      subject: profile.subject as Subject,
      strandKey: profile.strandKey,
      periodStart,
      score: profile.currentScore,
      growthRate,
      classification,
    });
  }

  recordMetricEvent(
    "longitudinal.snapshot.generated",
    {
      periodStart: periodStart.toISOString(),
      profileCount: profiles.length,
    },
    {
      scope: "school",
      scopeId: schoolId,
      schoolId,
    }
  ).catch(() => {});

  return { snapshotsWritten: profiles.length, sampleSize: profiles.length };
}
