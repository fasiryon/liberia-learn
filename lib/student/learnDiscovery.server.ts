import { loadCheckDiscovery } from "@/lib/student/checkDiscovery.server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { learnerRowAllowed, learnerScopeAllows, learnerVisibilityWhere, loadLearnerScope } from "@/lib/curriculum/learnerEligibility";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";
import { isAssignmentVisibleToStudent, listAssignmentTargeting } from "@/lib/assignments/targeting";
import { deriveUnitName } from "@/lib/student/unitSequence";

type Learner = { id: string; schoolId?: string | null };
export const DISCOVERY_LIMIT = 100;

// Raw eligibility inputs stay on the server. All response fields are projected explicitly.
export const learnerDiscoverySelect = {
  id: true, contentId: true, title: true, subject: true, grade: true, contentType: true,
  unitId: true, orderInUnit: true, lessonType: true, status: true, payload: true,
  visibility: true, versionId: true, curriculumVersion: { select: { status: true } },
  schoolId: true, teacherCreated: true, provenance: { select: { lifecycleState: true } },
  updatedAt: true, thumbnailUrl: true, thumbnailStatus: true,
} satisfies Prisma.CurriculumContentSelect;

export async function listAuthorizedLearnerContent(user: Learner, where: Prisma.CurriculumContentWhereInput = {}, take = DISCOVERY_LIMIT) {
  const scope = await loadLearnerScope(prisma, user);
  const visible: Array<Prisma.CurriculumContentGetPayload<{ select: typeof learnerDiscoverySelect }>> = [];
  const batchSize = Math.min(take, DISCOVERY_LIMIT);
  for (let skip = 0; visible.length < take; skip += batchSize) {
    const rows = await prisma.curriculumContent.findMany({
      where: { AND: [{ status: { in: ["published", "APPROVED"] } }, learnerVisibilityWhere(scope), where] },
      select: learnerDiscoverySelect,
      orderBy: [{ subject: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }, { contentId: "asc" }], skip, take: batchSize,
    });
    for (const row of rows) {
      if (["published", "APPROVED"].includes(row.status) && learnerRowAllowed(row) && await learnerScopeAllows(prisma, row, scope)) visible.push(row);
      if (visible.length === take) break;
    }
    if (rows.length < batchSize) break;
  }
  return visible;
}

export function displayLesson(row: Awaited<ReturnType<typeof listAuthorizedLearnerContent>>[number]) {
  return {
    contentId: row.contentId, state: "open" as const, locked: false, availability: "current" as const,
    title: buildCurriculumDisplayTitle({ title: row.title, subject: row.subject, gradeLevel: row.grade }),
    subject: String(row.subject), grade: row.grade, contentType: row.contentType,
    status: row.status, thumbnailUrl: row.thumbnailUrl, thumbnailStatus: row.thumbnailStatus,
    unitId: row.unitId, href: `/student/lesson/${encodeURIComponent(row.contentId)}`,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function unavailableDiscovery() {
  return {
    schemaVersion: "learn-discovery/2" as const, availability: "unavailable" as const,
    generatedAt: new Date().toISOString(), freshness: "unavailable" as const,
    currentLearning: { availability: "separate" as const, endpoint: "/api/student/learning-authority/next-action" },
    subjects: [],
    lessons: { availability: "unavailable" as const, total: 0, items: [] },
    activeUnits: { availability: "unavailable" as const, eligibility: "unavailable" as const, items: [] },
    assignedWork: { availability: "unavailable" as const, items: [] },
    checks: { availability: "unavailable" as const, total: 0, items: [] },
    resources: { availability: "unavailable" as const, items: [], destinations: [], compiledBooks: "deferred" as const }, subjectCompletion: [],
    search: { availability: "deferred" as const }, limits: { perSection: DISCOVERY_LIMIT, linkedContent: DISCOVERY_LIMIT * 2, catalogBoundReached: false },
  };
}

/** Display catalog only. Never invokes a decision, creates a session, or writes learning state. */
export async function loadLearnDiscovery(user: Learner, paging: { page?: number; pageSize?: number } = {}) {
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, currentGrade: true, deletedAt: true, user: { select: { schoolId: true } },
      enrollments: { select: { classId: true, Class: { select: { schoolId: true, subject: true } } } } },
  });
  const base = unavailableDiscovery();
  if (!student || student.deletedAt || !user.schoolId || student.user.schoolId !== user.schoolId) return base;
  const enrollments = student.enrollments.filter((e) => e.Class.schoolId === user.schoolId);
  const classIds = enrollments.map((e) => e.classId);
  const subjects = [...new Set(enrollments.map((e) => e.Class.subject))];
  const [assignments, scheduled] = classIds.length ? await Promise.all([
    prisma.assignment.findMany({
      where: { classId: { in: classIds }, Class: { schoolId: user.schoolId } },
      select: { id: true, title: true, classId: true, contentId: true, scheduledWorkId: true, dueAt: true,
        Class: { select: { schoolId: true, subject: true } } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: DISCOVERY_LIMIT,
    }),
    prisma.scheduledWork.findMany({
      where: { classId: { in: classIds }, class: { schoolId: user.schoolId },
        scheduledDate: { gte: new Date(Date.now() - 7 * 86400000), lte: new Date(Date.now() + 7 * 86400000) } },
      select: { id: true, contentId: true, classId: true, class: { select: { schoolId: true } } },
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }], take: DISCOVERY_LIMIT,
    }),
  ]) : [[], []];
  const targeting = await listAssignmentTargeting(assignments.map((a) => a.id), { failClosed: true });
  const allowedAssignments = assignments.filter((a) => classIds.includes(a.classId) && a.Class.schoolId === user.schoolId && isAssignmentVisibleToStudent(a.id, student.id, targeting));
  const assignmentScheduleIds = allowedAssignments.flatMap((a) => a.scheduledWorkId ? [a.scheduledWorkId] : []);
  const assignmentSchedules = assignmentScheduleIds.length ? await prisma.scheduledWork.findMany({
    where: { id: { in: assignmentScheduleIds }, classId: { in: classIds }, class: { schoolId: user.schoolId } },
    select: { id: true, contentId: true, classId: true, class: { select: { schoolId: true } } },
    take: DISCOVERY_LIMIT,
  }) : [];
  const allowedScheduled = [...scheduled, ...assignmentSchedules].filter((s) => classIds.includes(s.classId) && s.class.schoolId === user.schoolId);
  // Resolve linked work independently of the bounded catalog; an omitted catalog row isn't a denial.
  const linkedIds = [...new Set([...allowedAssignments.flatMap((a) => a.contentId ? [a.contentId] : []), ...allowedScheduled.map((s) => s.contentId)])];
  const [catalog, linked] = await Promise.all([
    student.currentGrade && subjects.length ? listAuthorizedLearnerContent(user, { grade: student.currentGrade, subject: { in: subjects } }) : Promise.resolve([]),
    linkedIds.length ? listAuthorizedLearnerContent(user, { contentId: { in: linkedIds } }, DISCOVERY_LIMIT * 2) : Promise.resolve([]),
  ]);
  const byId = new Map([...catalog, ...linked].map((row) => [row.contentId, row]));
  const safeScheduled = allowedScheduled.filter((s) => byId.has(s.contentId));
  const progress = safeScheduled.length ? await prisma.studentProgress.findMany({
    where: { studentId: user.id, scheduledWorkId: { in: safeScheduled.map((s) => s.id) }, completedAt: { not: null } },
    select: { scheduledWorkId: true },
  }) : [];
  const completed = new Set(progress.map((row) => row.scheduledWorkId));
  const subjectCompletion = subjects.map((subject) => {
    const work = [...new Map(safeScheduled.filter((s) => byId.get(s.contentId)!.subject === subject).map((s) => [s.id, s])).values()];
    const completedCount = work.filter((s) => completed.has(s.id)).length;
    return { subject: String(subject), total: work.length, completed: completedCount, completionRate: work.length ? Math.round(completedCount / work.length * 100) : 0 };
  });
  const activeUnitIds = new Set(safeScheduled.filter((s) => scheduled.some((current) => current.id === s.id)).map((s) => byId.get(s.contentId)!.unitId).filter(Boolean));
  const lessonPage = student.currentGrade && subjects.length ? await loadAuthorizedLessonPage(user, {
    grade: student.currentGrade, subject: { in: subjects }, contentType: "lesson",
  }, paging.page ?? 1, paging.pageSize ?? DISCOVERY_LIMIT) : { total: 0, items: [] };
  const lessons = lessonPage.items;
  const resources = catalog.filter((row) => ["lesson", "unit_plan", "term_plan", "full_pack"].includes(row.contentType)).map(displayLesson);
  const activeUnits = [...activeUnitIds].map((unitId) => {
    const rows = [...byId.values()].filter((row) => row.unitId === unitId);
    return { unitId: unitId!, state: "open" as const, locked: false, href: `/student/units/${encodeURIComponent(unitId!)}`, title: deriveUnitName(unitId!, null, rows.map((row) => row.title ?? "")),
      subject: String(rows[0].subject), grade: rows[0].grade, lessons: rows.map(displayLesson) };
  });
  const assignedWork = allowedAssignments.flatMap((a) => {
    const deniedContent = Boolean(a.contentId && !byId.has(a.contentId));
    // A linked schedule must still be accessible, in this assignment's class, with the same content.
    if (a.scheduledWorkId && !safeScheduled.some((s) => s.id === a.scheduledWorkId && s.classId === a.classId && (!a.contentId || s.contentId === a.contentId))) return [];
    return [{ id: a.id, title: a.title, subject: String(a.Class.subject), dueAt: a.dueAt?.toISOString() ?? null,
      content: a.contentId && !deniedContent ? displayLesson(byId.get(a.contentId)!) : null, href: deniedContent ? null : "/student/assignments", assignmentHref: "/student/assignments",
      state: deniedContent ? "unavailable" as const : "open" as const, locked: deniedContent,
      ...(deniedContent ? { reason: "This activity is not available", lessonHref: null } : {}) }];
  });
  const checks = await loadCheckDiscovery(student, user.schoolId, classIds);
  const empty = !checks.items.length && !lessons.length && !activeUnits.length && !assignedWork.length && !resources.length;
  return { ...base, availability: empty ? "empty" as const : "current" as const, freshness: "current" as const,
    subjects: subjects.map((subject) => ({ subject: String(subject), label: String(subject).replaceAll("_", " ") })),
    lessons: { availability: lessonPage.total ? "current" as const : "empty" as const, total: lessonPage.total, items: lessons },
    activeUnits: { availability: activeUnits.length ? "current" as const : "empty" as const, eligibility: classIds.length ? "eligible" as const : "not_enrolled" as const, items: activeUnits },
    assignedWork: { availability: assignedWork.length ? "current" as const : "empty" as const, items: assignedWork }, checks,
    resources: { availability: resources.length ? "current" as const : "empty" as const, items: resources.map((item) => ({ ...item, id: item.contentId, kind: "reading" as const })), destinations: [{ title: "Textbooks", href: "/student/textbooks" }], compiledBooks: "deferred" as const }, subjectCompletion,
    limits: { perSection: DISCOVERY_LIMIT, linkedContent: DISCOVERY_LIMIT * 2, catalogBoundReached: catalog.length === DISCOVERY_LIMIT } };
}

export type LearnDiscoveryReadModel = Awaited<ReturnType<typeof loadLearnDiscovery>>;

/** A slow display read is unavailable, never a successful empty catalog. Queries remain read-only. */
export async function readLearnDiscovery(user: Learner, paging: { page?: number; pageSize?: number } = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([loadLearnDiscovery(user, paging), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Discovery unavailable")), 8_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Count after the same final eligibility gates, retaining only the requested display page in memory. */
async function loadAuthorizedLessonPage(user: Learner, where: Prisma.CurriculumContentWhereInput, page: number, pageSize: number) {
  const scope = await loadLearnerScope(prisma, user);
  const items: ReturnType<typeof displayLesson>[] = [];
  let total = 0;
  for (let skip = 0; ; skip += DISCOVERY_LIMIT) {
    const rows = await prisma.curriculumContent.findMany({
      where: { AND: [{ status: { in: ["published", "APPROVED"] } }, learnerVisibilityWhere(scope), where] },
      select: learnerDiscoverySelect, orderBy: [{ subject: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }, { contentId: "asc" }],
      skip, take: DISCOVERY_LIMIT,
    });
    for (const row of rows) {
      if (!["published", "APPROVED"].includes(row.status) || !learnerRowAllowed(row) || !await learnerScopeAllows(prisma, row, scope)) continue;
      if (total >= (page - 1) * pageSize && items.length < pageSize) items.push(displayLesson(row));
      total++;
    }
    if (rows.length < DISCOVERY_LIMIT) break;
  }
  return { total, items };
}
