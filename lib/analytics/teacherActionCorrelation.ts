// lib/analytics/teacherActionCorrelation.ts — Sprint 7
// Teacher action correlation analytics using Sprint 2 TeacherAction data.
// Internal API only.

import { prisma } from "@/lib/db";

export interface TeacherActionReport {
  totalActions: number;
  uniqueTeachers: number;
  byActionType: Array<{
    actionType: string;
    count: number;
    pct: number;
  }>;
  topActiveTeachers: Array<{
    teacherUserId: string;
    actionCount: number;
  }>;
  actionsByDay: Array<{
    date: string;
    count: number;
  }>;
}

export interface TeacherActionOptions {
  schoolId?: string | null;
  since?: Date;
  topN?: number;
}

export async function getTeacherActionCorrelation(
  options: TeacherActionOptions = {}
): Promise<TeacherActionReport> {
  const { schoolId, since, topN = 10 } = options;

  const actions = await prisma.teacherAction.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      ...(since ? { occurredAt: { gte: since } } : {}),
    },
    select: {
      teacherUserId: true,
      actionType: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "asc" },
  });

  if (actions.length === 0) {
    return { totalActions: 0, uniqueTeachers: 0, byActionType: [], topActiveTeachers: [], actionsByDay: [] };
  }

  const total = actions.length;
  const uniqueTeachers = new Set(actions.map((a) => a.teacherUserId)).size;

  // By action type
  const typeMap = new Map<string, number>();
  for (const a of actions) {
    typeMap.set(a.actionType, (typeMap.get(a.actionType) ?? 0) + 1);
  }
  const byActionType = Array.from(typeMap.entries())
    .map(([actionType, count]) => ({
      actionType,
      count,
      pct: Math.round((count / total) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Top active teachers
  const teacherMap = new Map<string, number>();
  for (const a of actions) {
    teacherMap.set(a.teacherUserId, (teacherMap.get(a.teacherUserId) ?? 0) + 1);
  }
  const topActiveTeachers = Array.from(teacherMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([teacherUserId, actionCount]) => ({ teacherUserId, actionCount }));

  // Actions by day
  const dayMap = new Map<string, number>();
  for (const a of actions) {
    const day = a.occurredAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const actionsByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { totalActions: total, uniqueTeachers, byActionType, topActiveTeachers, actionsByDay };
}
