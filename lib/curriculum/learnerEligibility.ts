import type { Prisma } from "@prisma/client";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { isNativeCurriculumV2Payload } from "@/lib/curriculum/v2/contract";

/**
 * The one learner-visibility rule set for curriculum rows. The Tutor and the learner curriculum
 * listing both apply it, so a row a student cannot open through one surface never appears in the other.
 */
export type LearnerVisibilityScope = Readonly<{ schoolId: string | null; classIds: readonly string[] }>;

const RESTRICTED_ROW_VISIBILITY = ["teacher_only", "private"];
const RESTRICTED_PAYLOAD_AUDIENCE = ["teacher", "teacher_only", "staff", "private"];

/**
 * Database prefilter: platform rows (not teacher-created), or own-school rows that are school-wide or
 * assigned to one of the student's classes; an ACTIVE curriculum version when one is set; an APPROVED
 * governed lifecycle when one exists; never a teacher-only or private row.
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
      { visibility: { notIn: RESTRICTED_ROW_VISIBILITY } },
    ],
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Row-level checks the database cannot express: payload audience and native release authority. */
export function learnerRowAllowed(row: {
  visibility: string;
  versionId?: string | null;
  curriculumVersion?: { status: string } | null;
  payload: unknown;
}): boolean {
  if (RESTRICTED_ROW_VISIBILITY.includes(row.visibility)) return false;
  if (row.versionId && row.curriculumVersion?.status !== "ACTIVE") return false;
  const payload = record(row.payload);
  const audienceValue = payload.audience || payload.visibility;
  const audience = typeof audienceValue === "string" ? audienceValue.trim().toLowerCase() : "";
  if (RESTRICTED_PAYLOAD_AUDIENCE.includes(audience) || payload.teacherOnly === true) return false;
  // A native scene payload is learner-visible only when it projects cleanly as an approved release.
  if (!isNativeCurriculumV2Payload(row.payload)) return true;
  const projected = projectStudentLessonPayload(row.payload);
  return projected.studentReady === true && record(record(projected.lessonExperience).authority).status === "APPROVED_RELEASE";
}
