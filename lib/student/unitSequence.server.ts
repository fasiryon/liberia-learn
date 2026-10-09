/** Server unit display loader. Curriculum eligibility and own-school enrollment
 * scope govern every lesson and delivery link; completion remains StudentProgress. */
import { listAuthorizedLearnerContent } from "@/lib/student/learnDiscovery.server";
import { loadLearnerScope } from "@/lib/curriculum/learnerEligibility";
import { prisma } from "@/lib/db";
import { buildUnitSequence, type UnitSequence } from "@/lib/student/unitSequence";


export async function loadUnitSequenceForStudent(input: {
  unitId: string;
  studentUserId: string;
  schoolId?: string | null;
  currentContentId?: string | null;
  currentScheduledWorkId?: string | null;
}): Promise<UnitSequence | null> {
  const user = { id: input.studentUserId, schoolId: input.schoolId };
  const scope = await loadLearnerScope(prisma, user);
  const lessons = await listAuthorizedLearnerContent(user, { unitId: input.unitId });
  if (input.currentContentId && !lessons.some((lesson) => lesson.contentId === input.currentContentId)) return null;

  if (lessons.length === 0) return null;

  const contentIds = lessons.map((l) => l.contentId);
  const idToContentId = new Map(lessons.map((l) => [l.id, l.contentId]));

  const [unit, progressRows, prereqRows] = await Promise.all([
    prisma.curriculumUnit.findFirst({
      where: { unitId: input.unitId },
      select: { name: true, title: true },
    }),
    prisma.studentProgress.findMany({
      where: {
        studentId: input.studentUserId,
        scheduledWork: { contentId: { in: contentIds }, classId: { in: [...scope.classIds] }, class: { schoolId: scope.schoolId ?? "__no_school__" } },
      },
      select: {
        completedAt: true,
        scheduledWork: { select: { id: true, contentId: true } },
      },
    }),
    prisma.lessonPrerequisite.findMany({
      where: { lessonId: { in: lessons.map((l) => l.id) }, strength: "required" },
      select: { lessonId: true, prerequisiteLessonId: true },
    }),
  ]);

  const progressByContentId = new Map<string, { scheduledWorkId: string | null; completed: boolean }>();
  for (const row of progressRows) {
    const cid = row.scheduledWork.contentId;
    const existing = progressByContentId.get(cid);
    progressByContentId.set(cid, {
      scheduledWorkId: row.scheduledWork.id,
      completed: Boolean(row.completedAt) || Boolean(existing?.completed),
    });
  }

  // The lesson the student is currently viewing always resolves to its own
  // delivery URL even before a progress row exists.
  if (
    input.currentContentId &&
    input.currentScheduledWorkId &&
    !progressByContentId.has(input.currentContentId) &&
    await prisma.scheduledWork.findFirst({
      where: { id: input.currentScheduledWorkId, contentId: input.currentContentId, classId: { in: [...scope.classIds] }, class: { schoolId: scope.schoolId ?? "__no_school__" } },
      select: { id: true },
    })
  ) {
    progressByContentId.set(input.currentContentId, {
      scheduledWorkId: input.currentScheduledWorkId,
      completed: false,
    });
  }

  const requiredPrereqsByContentId = new Map<string, string[]>();
  for (const edge of prereqRows) {
    const cid = idToContentId.get(edge.lessonId);
    const pcid = idToContentId.get(edge.prerequisiteLessonId);
    if (!cid || !pcid) continue; // keep only within-unit edges
    const arr = requiredPrereqsByContentId.get(cid) ?? [];
    arr.push(pcid);
    requiredPrereqsByContentId.set(cid, arr);
  }

  return buildUnitSequence({
    unitId: input.unitId,
    curriculumUnitName: unit?.name ?? unit?.title ?? null,
    currentContentId: input.currentContentId ?? null,
    lessons,
    progressByContentId,
    requiredPrereqsByContentId,
  });
}

/** Resolve the unitId for a piece of content, or null if it has none. */
export async function resolveUnitIdForContent(contentId: string): Promise<string | null> {
  const content = await prisma.curriculumContent.findFirst({
    where: { contentId },
    select: { unitId: true },
  });
  return content?.unitId ?? null;
}

export type ActiveUnitSummary = {
  unitId: string;
  unitName: string;
  subject: string;
  grade: number;
  completedCount: number;
  totalCount: number;
  completionPct: number;
};

/**
 * Units the student is actively moving through — derived from the lessons
 * scheduled to their own-school class(es) in a window around today. Uses catalog
 * order without deriving a next action. Empty array when the student has no schedule.
 */
export async function loadActiveUnitsForStudent(
  studentUserId: string,
  opts: { windowDays?: number; limit?: number; schoolId?: string | null } = {}
): Promise<ActiveUnitSummary[]> {
  const windowDays = opts.windowDays ?? 7;
  const limit = opts.limit ?? 6;

  const user = { id: studentUserId, schoolId: opts.schoolId };
  const scope = await loadLearnerScope(prisma, user);
  const classIds = [...scope.classIds];
  if (classIds.length === 0) return [];

  const now = Date.now();
  const from = new Date(now - windowDays * 86400000);
  const to = new Date(now + windowDays * 86400000);

  const scheduled = await prisma.scheduledWork.findMany({
    where: { classId: { in: classIds }, class: { schoolId: scope.schoolId ?? "__no_school__" }, scheduledDate: { gte: from, lte: to } },
    select: { contentId: true },
    orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
    take: 100,
  });
  const contentIds = [...new Set(scheduled.map((s) => s.contentId))];
  if (contentIds.length === 0) return [];

  const contents = await listAuthorizedLearnerContent(user, { contentId: { in: contentIds }, unitId: { not: null } });
  const unitIds = [...new Set(contents.map((c) => c.unitId).filter((u): u is string => Boolean(u)))];
  if (unitIds.length === 0) return [];

  const sequences = await Promise.all(
    unitIds.map((unitId) => loadUnitSequenceForStudent({ unitId, studentUserId, schoolId: opts.schoolId }))
  );

  return sequences
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({
      unitId: s.unitId,
      unitName: s.unitName,
      subject: s.subject,
      grade: s.grade,
      completedCount: s.completedCount,
      totalCount: s.totalCount,
      completionPct: s.completionPct,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.unitId.localeCompare(b.unitId))
    .slice(0, limit);
}
