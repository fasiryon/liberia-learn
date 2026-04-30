import { prisma } from "@/lib/db";

export type AssignmentTargetingRecord = {
  assignmentId: string;
  targetStudentIds: string[];
};

function normalizeStudentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

export async function listAssignmentTargeting(assignmentIds: string[]): Promise<Map<string, string[]>> {
  const ids = [...new Set(assignmentIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await ((prisma as any).teacherAction?.findMany?.({
    where: {
      actionType: "assignment_targeting",
      targetType: "assignment",
      targetId: { in: ids },
    },
    select: { targetId: true, metadata: true },
  }) ?? Promise.resolve([])).catch(() => []);

  const map = new Map<string, string[]>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const targetId = typeof row.targetId === "string" ? row.targetId : null;
    if (!targetId) continue;
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const targetStudentIds = normalizeStudentIds((metadata as any).targetStudentIds);
    if (targetStudentIds.length > 0) {
      map.set(targetId, targetStudentIds);
    }
  }
  return map;
}

export async function getAssignmentTargetStudentIds(assignmentId: string): Promise<string[]> {
  return (await listAssignmentTargeting([assignmentId])).get(assignmentId) ?? [];
}

export function isAssignmentVisibleToStudent(
  assignmentId: string,
  studentId: string,
  targeting: Map<string, string[]>
) {
  const targetStudentIds = targeting.get(assignmentId);
  return !targetStudentIds || targetStudentIds.length === 0 || targetStudentIds.includes(studentId);
}
