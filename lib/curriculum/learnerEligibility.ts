import type { Prisma } from "@prisma/client";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { isNativeCurriculumV2Payload } from "@/lib/curriculum/v2/contract";

/**
 * The one learner-visibility rule set for curriculum rows. The learner listing, the learner detail
 * route and the Tutor all apply it, so a row a student cannot open through one surface is never
 * reachable through another. Every dimension is checked independently and must pass on its own: a
 * "student" signal on one field never overrides a restriction on another, and malformed restriction
 * metadata fails closed.
 */
export type LearnerVisibilityScope = Readonly<{ schoolId: string | null; classIds: readonly string[] }>;

/** Row visibilities a learner may see. Any other value (teacher_only, private, internal, malformed) is denied. */
const LEARNER_ROW_VISIBILITY = ["class_only", "school_wide", "public"];
/** Payload `audience` / `visibility` values that address learners. Absent means unrestricted. */
const LEARNER_PAYLOAD_AUDIENCE = ["student", "students", "learner", "learners", "all", "everyone", "public", "class", "class_only", "school", "school_wide"];
/** Payload restriction flags: present with any value other than `false` denies the row. */
const RESTRICTION_FLAGS = ["teacherOnly", "reviewerOnly", "staffOnly", "internal", "private", "hidden"];

type ProvenanceState = { lifecycleState: string } | null | undefined;

/**
 * Database prefilter: platform rows (not teacher-created), or own-school rows that are school-wide or
 * assigned to one of the student's classes; an ACTIVE curriculum version when one is set; an APPROVED
 * governed lifecycle when one exists; a learner row visibility. The in-memory gates below repeat
 * every one of these checks, so no caller depends on this filter alone.
 */
export function learnerVisibilityWhere(scope: LearnerVisibilityScope): Prisma.CurriculumContentWhereInput {
  const ownSchool: Prisma.CurriculumContentWhereInput[] = scope.schoolId
    ? [
        { schoolId: scope.schoolId, visibility: "school_wide" },
        ...(scope.classIds.length
          ? [
              { schoolId: scope.schoolId, scheduledWork: { some: { classId: { in: [...scope.classIds] }, class: { schoolId: scope.schoolId } } } },
              { schoolId: scope.schoolId, teacherLessonAssignments: { some: { classId: { in: [...scope.classIds] }, class: { schoolId: scope.schoolId } } } },
            ]
          : []),
      ]
    : [];
  return {
    AND: [
      { OR: [{ schoolId: null, teacherCreated: false }, ...ownSchool] },
      { OR: [{ versionId: null }, { curriculumVersion: { is: { status: "ACTIVE" } } }] },
      { OR: [{ provenance: { is: null } }, { provenance: { is: { lifecycleState: "APPROVED" } } }] },
      { visibility: { in: LEARNER_ROW_VISIBILITY } },
    ],
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** A payload audience/visibility value: absent or a learner value passes; anything else (incl. non-strings) fails. */
function learnerAudienceValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || LEARNER_PAYLOAD_AUDIENCE.includes(normalized);
}

/**
 * Content gates (no lifecycle, no school scope): row visibility, ACTIVE version, payload audience and
 * payload visibility each checked on its own, restriction flags, and native release authority.
 */
export function learnerContentAllowed(row: {
  visibility: unknown;
  versionId?: string | null;
  curriculumVersion?: { status: string } | null;
  payload: unknown;
}): boolean {
  if (typeof row.visibility !== "string" || !LEARNER_ROW_VISIBILITY.includes(row.visibility)) return false;
  if (row.versionId && row.curriculumVersion?.status !== "ACTIVE") return false;
  const payload = record(row.payload);
  if (!learnerAudienceValue(payload.audience) || !learnerAudienceValue(payload.visibility)) return false;
  if (RESTRICTION_FLAGS.some((flag) => flag in payload && payload[flag] !== false)) return false;
  // A native scene payload is learner-visible only when it projects cleanly as an approved release.
  if (!isNativeCurriculumV2Payload(row.payload)) return true;
  const projected = projectStudentLessonPayload(row.payload);
  return projected.studentReady === true && record(record(projected.lessonExperience).authority).status === "APPROVED_RELEASE";
}

/** A governed row is learner-visible only while its lifecycle is APPROVED; an ungoverned row passes. */
export function learnerLifecycleAllowed(provenance: ProvenanceState): boolean {
  return !provenance || provenance.lifecycleState === "APPROVED";
}

/** Content and lifecycle gates together (school and assignment scope: `learnerScopeAllows`). */
export function learnerRowAllowed(row: Parameters<typeof learnerContentAllowed>[0] & { provenance?: ProvenanceState }): boolean {
  return learnerContentAllowed(row) && learnerLifecycleAllowed(row.provenance);
}

type AssignmentWhere = { contentId: string; classId: { in: string[] }; class: { schoolId: string } };
type AssignmentReader = {
  scheduledWork: { findFirst(args: { where: AssignmentWhere; select: { id: true } }): Promise<unknown> };
  teacherLessonAssignment: { findFirst(args: { where: AssignmentWhere; select: { id: true } }): Promise<unknown> };
};

/**
 * School and assignment scope: a platform row that is not teacher-created, or an own-school row that
 * is school-wide or assigned to one of the student's own-school classes. Foreign-school rows never pass.
 */
export async function learnerScopeAllows(
  client: AssignmentReader,
  row: { contentId: string; schoolId: string | null; teacherCreated: boolean | null; visibility: unknown },
  scopeOrLoader: LearnerVisibilityScope | (() => Promise<LearnerVisibilityScope>),
): Promise<boolean> {
  if (!row.schoolId) return !row.teacherCreated;
  // The student's enrollments are read only when a school row needs them.
  const scope = typeof scopeOrLoader === "function" ? await scopeOrLoader() : scopeOrLoader;
  if (!scope.schoolId || row.schoolId !== scope.schoolId) return false;
  if (row.visibility === "school_wide") return true;
  if (!scope.classIds.length) return false;
  const where = { contentId: row.contentId, classId: { in: [...scope.classIds] }, class: { schoolId: scope.schoolId } };
  if (await client.scheduledWork.findFirst({ where, select: { id: true } })) return true;
  return Boolean(await client.teacherLessonAssignment.findFirst({ where, select: { id: true } }));
}

type StudentReader = {
  student: {
    findUnique(args: {
      where: { userId: string };
      select: { enrollments: { select: { classId: true; Class: { select: { schoolId: true } } } } };
    }): Promise<{ enrollments: Array<{ classId: string; Class: { schoolId: string | null } }> } | null>;
  };
};

/** The student's learner scope: their school and their enrolled classes in that school only. */
export async function loadLearnerScope(client: StudentReader, user: { id: string; schoolId?: string | null }): Promise<LearnerVisibilityScope> {
  const student = await client.student.findUnique({
    where: { userId: user.id },
    select: { enrollments: { select: { classId: true, Class: { select: { schoolId: true } } } } },
  });
  const schoolId = user.schoolId ?? null;
  const classIds = (student?.enrollments ?? [])
    .filter((enrollment) => schoolId && enrollment.Class.schoolId === schoolId)
    .map((enrollment) => enrollment.classId);
  return { schoolId, classIds };
}
