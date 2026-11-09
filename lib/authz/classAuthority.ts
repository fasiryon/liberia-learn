/**
 * Class-authority service (COS-CLASS-AUTHORITY-DESIGN.md section A, founder decisions D1-D3, policy P1-P6).
 * The one place teacher-scope decisions are made. Rules run in order, the first deny wins, the default is deny:
 *
 * 1. No viewer school, a missing class, or a class of another school: deny (P4). No platform-admin bypass here.
 * 2. Official grade overrides and promotion changes: always denied until section C is authorized and built.
 * 3. An ADMIN of the class's school: the class functions (P3, oversight).
 * 4. The class's primary teacher (Class.teacherId): the class functions.
 * 5. A TeacherAssignment for (school, viewer, class, subject), with the subject given and matching: the class
 *    functions for that subject only (D1). isPrimary does not widen it; a missing subject denies this basis.
 * 6. Delegation (section B) does not exist yet, so it grants nothing.
 * 7. Otherwise deny: same-school membership is never a basis (P1, P5).
 */
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// D1 co-teacher functions: instructional access (read.learning), feedback, assessment review, and lesson support
// (lesson.support: assigning class work such as linking a lab to scheduled work, AT-GRADE-01 batch 2b).
export const CLASS_FUNCTIONS = ["class.read.learning", "class.feedback", "class.assessment.review", "class.lesson.support"] as const;
export const SECTION_C_FUNCTIONS = ["grade.official.override.request", "grade.official.override.approve", "promotion.change"] as const;
// Functions only the class teacher or a school ADMIN hold: a TeacherAssignment never grants them, and no delegation exists
// (CoS ruling 7: attendance is not one of D1's co-teacher functions).
export const CLASS_TEACHER_ONLY_FUNCTIONS = ["class.attendance"] as const;
export type ClassFunction = (typeof CLASS_FUNCTIONS)[number] | (typeof CLASS_TEACHER_ONLY_FUNCTIONS)[number] | (typeof SECTION_C_FUNCTIONS)[number];
export type ClassAuthorityBasis = "CLASS_TEACHER" | "SUBJECT_ASSIGNMENT" | "DELEGATION" | "SCHOOL_ADMIN";
export type ClassAuthorityDenial =
  | "no_viewer_school" | "class_missing" | "cross_school" | "official_function_not_available" | "role_not_permitted"
  | "subject_required" | "subject_not_assigned" | "no_class_assignment" | "class_teacher_only";
export type ClassAuthorityDecision = Readonly<{ allowed: true; basis: ClassAuthorityBasis }> | Readonly<{ allowed: false; reason: ClassAuthorityDenial }>;

const deny = (reason: ClassAuthorityDenial): ClassAuthorityDecision => ({ allowed: false, reason });

// The repository compiles with strict: false, where a union does not narrow on the boolean `allowed`. Read `reason`
// and `basis` only through these guards.
export const isClassAccessDenied = (decision: ClassAuthorityDecision): decision is Extract<ClassAuthorityDecision, { allowed: false }> => !decision.allowed;
export const isClassAccessAllowed = (decision: ClassAuthorityDecision): decision is Extract<ClassAuthorityDecision, { allowed: true }> => decision.allowed;

/** A free-text subject (for example VirtualLab.subject) in the Subject enum's form; unrecognised text matches nothing. */
export const normalizeClassSubject = (subject: string) => subject.trim().toUpperCase().replace(/\s+/g, "_");

/**
 * True only when a free-text subject (VirtualLab.subject) is already written exactly as a Subject enum value form
 * (founder decision 3): "Physics", "science" or a missing subject is an unclassified lab and grants a co-teacher
 * nothing. No mapping and no normalization of the lab's subject; the service still compares it with the assignment.
 */
export const isExactSubjectValue = (subject: unknown): subject is string =>
  typeof subject === "string" && subject.length > 0 && normalizeClassSubject(subject) === subject;

export async function authorizeClassAccess(
  user: Pick<SessionUser, "id" | "role" | "schoolId">,
  request: Readonly<{ classId: string; subject?: string | null; fn: ClassFunction; now?: Date }>,
): Promise<ClassAuthorityDecision> {
  if (!user.schoolId) return deny("no_viewer_school");
  if (!request.classId) return deny("class_missing");
  const cls = await prisma.class.findUnique({ where: { id: request.classId }, select: { schoolId: true, teacherId: true } });
  if (!cls) return deny("class_missing");
  if (!cls.schoolId || cls.schoolId !== user.schoolId) return deny("cross_school");
  const teacherOnly = (CLASS_TEACHER_ONLY_FUNCTIONS as readonly string[]).includes(request.fn);
  if (!teacherOnly && !(CLASS_FUNCTIONS as readonly string[]).includes(request.fn)) return deny("official_function_not_available");
  if (user.role === "ADMIN") return { allowed: true, basis: "SCHOOL_ADMIN" };
  if (user.role !== "TEACHER") return deny("role_not_permitted");
  if (cls.teacherId && cls.teacherId === user.id) return { allowed: true, basis: "CLASS_TEACHER" };
  if (teacherOnly) return deny("class_teacher_only");
  const assignments = await prisma.teacherAssignment.findMany({
    where: { schoolId: user.schoolId, teacherId: user.id, classId: request.classId },
    select: { subject: true },
  });
  if (assignments.length === 0) return deny("no_class_assignment");
  if (!request.subject) return deny("subject_required");
  const subject = normalizeClassSubject(request.subject);
  return assignments.some((assignment) => String(assignment.subject) === subject) ? { allowed: true, basis: "SUBJECT_ASSIGNMENT" } : deny("subject_not_assigned");
}
