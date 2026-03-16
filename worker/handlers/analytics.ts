import type { PrismaClient, Subject } from "@prisma/client";
import { isRdsDualWriteEnabled, logRdsDualWriteError, prisma, rdsPrisma } from "@/lib/db";

type AnalyticsJobPayload = {
  schoolId: string;
  tenantId?: string;
  snapshotDate?: string;
};

type AnalyticsAggregate = {
  tenantId: string;
  schoolId: string;
  studentId: string;
  subject: Subject;
  periodStart: Date;
  score: number;
  classification: "on_track" | "at_risk" | "accelerating";
};

function startOfDayUtc(value?: string) {
  const date = value ? new Date(value) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDayUtc(startOfDay: Date) {
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
}

function toSubject(value: string): Subject {
  return value.toUpperCase() as Subject;
}

function classifyScore(score: number): "on_track" | "at_risk" | "accelerating" {
  if (score >= 0.9) return "accelerating";
  if (score < 0.5) return "at_risk";
  return "on_track";
}

async function upsertDailySnapshot(client: PrismaClient, aggregate: AnalyticsAggregate) {
  const existing = await client.longitudinalSnapshot.findFirst({
    where: {
      tenantId: aggregate.tenantId,
      schoolId: aggregate.schoolId,
      studentId: aggregate.studentId,
      subject: aggregate.subject,
      strandKey: null,
      periodStart: aggregate.periodStart,
      periodType: "daily",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return client.longitudinalSnapshot.update({
      where: { id: existing.id },
      data: {
        score: aggregate.score,
        growthRate: 0,
        classification: aggregate.classification,
      },
    });
  }

  return client.longitudinalSnapshot.create({
    data: {
      tenantId: aggregate.tenantId,
      schoolId: aggregate.schoolId,
      studentId: aggregate.studentId,
      subject: aggregate.subject,
      strandKey: null,
      periodStart: aggregate.periodStart,
      periodType: "daily",
      score: aggregate.score,
      growthRate: 0,
      classification: aggregate.classification,
    },
  });
}

export async function handleSnapshotAnalyticsJob(payload: AnalyticsJobPayload) {
  if (!payload?.schoolId) {
    throw new Error("schoolId is required for SNAPSHOT_ANALYTICS");
  }

  const periodStart = startOfDayUtc(payload.snapshotDate);
  const progressRows = await prisma.studentProgress.findMany({
    where: {
      completedAt: {
        gte: periodStart,
        lt: endOfDayUtc(periodStart),
      },
      student: {
        schoolId: payload.schoolId,
      },
    },
    select: {
      studentId: true,
      exitTicketScore: true,
      scheduledWork: {
        select: {
          content: {
            select: {
              subject: true,
            },
          },
        },
      },
    },
  });

  const aggregates = new Map<string, { total: number; count: number; studentId: string; subject: Subject }>();
  for (const row of progressRows) {
    const subject = toSubject(row.scheduledWork.content.subject);
    const key = `${row.studentId}:${subject}`;
    const current = aggregates.get(key) ?? {
      total: 0,
      count: 0,
      studentId: row.studentId,
      subject,
    };
    current.total += typeof row.exitTicketScore === "number" ? row.exitTicketScore / 100 : 0;
    current.count += 1;
    aggregates.set(key, current);
  }

  for (const aggregate of aggregates.values()) {
    const score = aggregate.count === 0 ? 0 : aggregate.total / aggregate.count;
    const snapshot: AnalyticsAggregate = {
      tenantId: payload.tenantId ?? payload.schoolId,
      schoolId: payload.schoolId,
      studentId: aggregate.studentId,
      subject: aggregate.subject,
      periodStart,
      score,
      classification: classifyScore(score),
    };

    await upsertDailySnapshot(prisma, snapshot);

    if (isRdsDualWriteEnabled() && rdsPrisma) {
      try {
        await upsertDailySnapshot(rdsPrisma, snapshot);
      } catch (error) {
        logRdsDualWriteError("analytics.longitudinalSnapshot", error);
      }
    }
  }

  return {
    snapshotsWritten: aggregates.size,
    sampleSize: progressRows.length,
  };
}
