// lib/analytics/retentionSummary.ts — Sprint 7
// Student retention analytics.
// Internal API only. Uses DerivedStudentProgress activity signals.

import { prisma } from "@/lib/db";

export interface RetentionSummaryReport {
  totalStudents: number;
  activeStudents: number;
  retentionRatePct: number;
  churned30d: number;
  newInPeriod: number;
  bySchool: Array<{
    schoolId: string;
    total: number;
    active: number;
    retentionRatePct: number;
  }>;
}

export interface RetentionSummaryOptions {
  schoolId?: string | null;
  activeSince?: Date;
}

export async function getRetentionSummary(
  options: RetentionSummaryOptions = {}
): Promise<RetentionSummaryReport> {
  const { schoolId } = options;
  const activeSince = options.activeSince ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalStudents, activeRecords, newStudents] = await Promise.all([
    prisma.student.count({
      where: {
        deletedAt: null,
        ...(schoolId ? { user: { schoolId } } : {}),
      },
    }),
    prisma.derivedStudentProgress.findMany({
      distinct: ["studentId"],
      where: { derivedAt: { gte: activeSince } },
      select: { studentId: true },
    }),
    prisma.student.count({
      where: {
        createdAt: { gte: newSince },
        deletedAt: null,
        ...(schoolId ? { user: { schoolId } } : {}),
      },
    }),
  ]);

  const activeStudents = activeRecords.length;
  const churned = Math.max(0, totalStudents - activeStudents - newStudents);

  // By school breakdown — only when not already scoped to one school
  let bySchool: RetentionSummaryReport["bySchool"] = [];
  if (!schoolId) {
    const schools = await prisma.school.findMany({
      select: { id: true },
    });

    bySchool = (
      await Promise.all(
        schools.map(async (s) => {
          const [total, active] = await Promise.all([
            prisma.student.count({
              where: { deletedAt: null, user: { schoolId: s.id } },
            }),
            prisma.derivedStudentProgress
              .findMany({
                distinct: ["studentId"],
                where: { derivedAt: { gte: activeSince } },
                select: { studentId: true },
              })
              .then((r) => r.length),
          ]);
          return {
            schoolId: s.id,
            total,
            active,
            retentionRatePct: total > 0 ? Math.round((active / total) * 10000) / 100 : 0,
          };
        })
      )
    ).filter((s) => s.total > 0);
  }

  return {
    totalStudents,
    activeStudents,
    retentionRatePct:
      totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 10000) / 100 : 0,
    churned30d: churned,
    newInPeriod: newStudents,
    bySchool,
  };
}
