import { prisma } from "@/lib/db";
import type { LongitudinalSnapshot, Subject } from "@prisma/client";

export function startOfMonthUtc(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function previousMonthStartUtc(periodStart: Date): Date {
  return new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1, 0, 0, 0, 0)
  );
}

export async function findSnapshotForPeriod(params: {
  tenantId: string;
  schoolId: string;
  studentId: string;
  subject: Subject;
  strandKey: string | null;
  periodStart: Date;
}): Promise<LongitudinalSnapshot | null> {
  const { tenantId, schoolId, studentId, subject, strandKey, periodStart } = params;
  return prisma.longitudinalSnapshot.findFirst({
    where: {
      tenantId,
      schoolId,
      studentId,
      subject,
      strandKey,
      periodType: "monthly",
      periodStart,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findPreviousSnapshot(params: {
  tenantId: string;
  schoolId: string;
  studentId: string;
  subject: Subject;
  strandKey: string | null;
  periodStart: Date;
}): Promise<LongitudinalSnapshot | null> {
  const { tenantId, schoolId, studentId, subject, strandKey, periodStart } = params;
  const prevPeriodStart = previousMonthStartUtc(periodStart);
  return prisma.longitudinalSnapshot.findFirst({
    where: {
      tenantId,
      schoolId,
      studentId,
      subject,
      strandKey,
      periodType: "monthly",
      periodStart: prevPeriodStart,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertMonthlySnapshot(params: {
  tenantId: string;
  schoolId: string;
  studentId: string;
  subject: Subject;
  strandKey: string | null;
  periodStart: Date;
  score: number;
  growthRate: number;
  classification: "on_track" | "at_risk" | "accelerating";
}): Promise<LongitudinalSnapshot> {
  const existing = await findSnapshotForPeriod(params);
  if (existing) {
    return prisma.longitudinalSnapshot.update({
      where: { id: existing.id },
      data: {
        score: params.score,
        growthRate: params.growthRate,
        classification: params.classification,
      },
    });
  }

  return prisma.longitudinalSnapshot.create({
    data: {
      tenantId: params.tenantId,
      schoolId: params.schoolId,
      studentId: params.studentId,
      subject: params.subject,
      strandKey: params.strandKey,
      periodStart: params.periodStart,
      periodType: "monthly",
      score: params.score,
      growthRate: params.growthRate,
      classification: params.classification,
    },
  });
}

export async function listSchoolSnapshotsForPeriod(params: {
  tenantId: string;
  schoolId: string;
  periodStart: Date;
}): Promise<LongitudinalSnapshot[]> {
  const { tenantId, schoolId, periodStart } = params;
  return prisma.longitudinalSnapshot.findMany({
    where: {
      tenantId,
      schoolId,
      periodType: "monthly",
      periodStart,
    },
    orderBy: [
      { subject: "asc" },
      { strandKey: "asc" },
      { createdAt: "desc" },
    ],
  });
}

export async function listStudentSnapshotsForPeriod(params: {
  tenantId: string;
  schoolId: string;
  studentIds: string[];
  periodStart: Date;
}): Promise<LongitudinalSnapshot[]> {
  const { tenantId, schoolId, studentIds, periodStart } = params;
  if (studentIds.length === 0) return [];

  return prisma.longitudinalSnapshot.findMany({
    where: {
      tenantId,
      schoolId,
      studentId: { in: studentIds },
      periodType: "monthly",
      periodStart,
    },
    orderBy: [
      { studentId: "asc" },
      { subject: "asc" },
      { strandKey: "asc" },
      { createdAt: "desc" },
    ],
  });
}
