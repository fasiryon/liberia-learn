import { prisma } from "@/lib/db";

export type TrainingReportRow = {
  teacherId: string;
  teacherName: string;
  schoolId: string | null;
  schoolName: string;
  county: string;
  completedModules: number;
  totalModules: number;
  completionPct: number;
  lastActivity: Date | null;
};

export const trainingReportHeaders = [
  "Teacher",
  "School",
  "County",
  "Completion",
  "Last Activity",
];

export function buildTrainingReportCsvRows(rows: TrainingReportRow[]): string[][] {
  return rows.map((row) => [
    row.teacherName,
    row.schoolName,
    row.county,
    `${row.completedModules}/${row.totalModules} (${row.completionPct}%)`,
    row.lastActivity ? row.lastActivity.toISOString().slice(0, 10) : "",
  ]);
}

export async function getTrainingReportRows({
  schoolId,
  pilotOnly,
}: {
  schoolId?: string | null;
  pilotOnly?: boolean;
}): Promise<TrainingReportRow[]> {
  const totalModules = await prisma.trainingModule.count({
    where: { isActive: true },
  });

  const where: any = { role: "TEACHER" };
  if (schoolId) where.schoolId = schoolId;
  if (pilotOnly) {
    where.school = { pilotStatus: { not: null } };
  }

  const teachers = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      schoolId: true,
      school: { select: { name: true, county: true, pilotStatus: true } },
      teacherProfile: { select: { fullName: true } },
    },
    orderBy: { name: "asc" },
  });

  const filteredTeachers = pilotOnly
    ? teachers.filter((t) => (t.school?.pilotStatus ?? "").trim().length > 0)
    : teachers;

  const teacherIds = filteredTeachers.map((t) => t.id);
  if (teacherIds.length === 0) return [];

  const progress = await prisma.trainingProgress.findMany({
    where: {
      teacherUserId: { in: teacherIds },
      module: { isActive: true },
    },
    select: {
      teacherUserId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  const completionByTeacher = new Map<string, { complete: number; last: Date | null }>();
  for (const entry of progress) {
    const current = completionByTeacher.get(entry.teacherUserId) ?? { complete: 0, last: null };
    if (entry.status === "complete") {
      current.complete += 1;
    }
    const candidate = entry.completedAt ?? entry.startedAt ?? entry.updatedAt ?? null;
    if (candidate) {
      if (!current.last || candidate > current.last) {
        current.last = candidate;
      }
    }
    completionByTeacher.set(entry.teacherUserId, current);
  }

  return filteredTeachers.map((teacher) => {
    const completion = completionByTeacher.get(teacher.id) ?? { complete: 0, last: null };
    const completionPct =
      totalModules > 0 ? Math.round((completion.complete / totalModules) * 100) : 0;
    return {
      teacherId: teacher.id,
      teacherName: teacher.teacherProfile?.fullName ?? teacher.name ?? "Teacher",
      schoolId: teacher.schoolId ?? null,
      schoolName: teacher.school?.name ?? "Unknown School",
      county: teacher.school?.county ?? "",
      completedModules: completion.complete,
      totalModules,
      completionPct,
      lastActivity: completion.last,
    };
  });
}
