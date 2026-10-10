import { prisma } from "@/lib/db";

type TeacherRef = { teacherId?: string | null; teacherName?: string | null };
type TeacherBearing = { timetable?: { periods?: TeacherRef[] } | null; schoolDay?: { items?: TeacherRef[] } | null };

const REVALIDATION_TIMEOUT_MS = 1500;

/**
 * Teacher names are presentation identity, not learner entitlement. Cached Today structure keeps
 * only `teacherId`; this re-reads every referenced teacher in ONE bounded query and projects a
 * name only for a teacher who currently belongs to the learner's school. Any stored
 * `teacherName` is ignored. If the lookup fails or is slow, no teacher name is projected.
 */
export async function withCurrentTeacherIdentity<T extends TeacherBearing>(payload: T, schoolId: string): Promise<T> {
  const refs = [...(payload.timetable?.periods ?? []), ...(payload.schoolDay?.items ?? [])];
  const ids = [...new Set(refs.flatMap((ref) => typeof ref?.teacherId === "string" && ref.teacherId ? [ref.teacherId] : []))];
  const names = new Map<string, string>();
  if (ids.length) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const teachers = await Promise.race([
        prisma.user.findMany({ where: { id: { in: ids }, schoolId }, select: { id: true, schoolId: true, name: true } }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("teacher identity unavailable")), REVALIDATION_TIMEOUT_MS); }),
      ]);
      for (const teacher of teachers) if (teacher.schoolId === schoolId && teacher.name?.trim()) names.set(teacher.id, teacher.name.trim());
    } catch {
      // Fail closed: structure is still returned, identity is not.
    } finally { if (timer) clearTimeout(timer); }
  }
  const project = <R extends TeacherRef>(ref: R): R => ({ ...ref, teacherName: (ref.teacherId && names.get(ref.teacherId)) || null });
  return {
    ...payload,
    ...(payload.timetable ? { timetable: { ...payload.timetable, ...(payload.timetable.periods ? { periods: payload.timetable.periods.map(project) } : {}) } } : {}),
    ...(payload.schoolDay ? { schoolDay: { ...payload.schoolDay, ...(payload.schoolDay.items ? { items: payload.schoolDay.items.map(project) } : {}) } } : {}),
  };
}

/** Cached structure keeps teacher ids only, never a display name. */
export function withoutTeacherNames<P extends TeacherRef>(periods: P[]): P[] {
  return periods.map((period) => ({ ...period, teacherName: null }));
}
