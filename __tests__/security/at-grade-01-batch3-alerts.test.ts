/**
 * AT-GRADE-01 batch 3, CoS ruling 9 + COS-BATCH3-RULINGS-20261028 C + the class-alert approval (2026-10-28):
 * a teacher's alert follows CURRENT class authority (lib/authz/classAuthority class.read.learning):
 * - student alerts (INACTIVE_STUDENT, UNRESOLVED_INTERVENTION, REPEATED_QUIZ_FAILURE): only while the owner holds
 *   class.read.learning on a class the student is currently enrolled in (own school);
 * - CLASS_AVERAGE_DROPPED and ASSIGNMENT_MISSED_BY_GROUP (no studentId; the latter names students): the class comes from
 *   this module's deterministic idempotencyKey (exact prefix and segment count; for assignments via Assignment.classId),
 *   must exist in the caller's school, and the owner must hold class.read.learning on it (the subject when known).
 *   Malformed or unresolvable keys, and another school's class, are HIDDEN (fail closed);
 * - WEAK_TOPIC_SEQUENCE_ADVISED, CURRICULUM_GAP_AFFECTING_CLASS, PACING_SUPPORT_NEEDED (no individual student data):
 *   owner-only;
 * - unknown types are hidden.
 * A hidden alert is also not reviewable, dismissable or actionable (404 before any write).
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const m = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  classTeacher: "teacher-A",
  studentClasses: { "stu-A": ["class-A"] } as Record<string, string[]>,
  update: vi.fn(), create: vi.fn(),
}));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: async () => undefined }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => undefined }));
vi.mock("@/lib/db", () => ({ prisma: {
  teacherAlert: {
    findMany: async ({ where }: { where: Row }) => m.rows.filter((r) => r.teacherUserId === where.teacherUserId && r.schoolId === where.schoolId && (!where.status || typeof where.status !== "string" || r.status === where.status)),
    findFirst: async ({ where }: { where: Row }) => m.rows.find((r) => r.id === where.id && r.teacherUserId === where.teacherUserId && r.schoolId === where.schoolId) ?? null,
    update: m.update,
  },
  teacherAction: { create: m.create },
  enrollment: { findMany: async ({ where }: { where: { OR: Array<Record<string, any>> } }) => {
    const id = where.OR.map((c) => c.studentId ?? c.Student?.userId).find(Boolean) as string;
    return (m.studentClasses[id] ?? []).map((classId) => ({ classId }));
  } },
  class: { findUnique: async ({ where }: { where: { id: string } }) => ({ "class-A": { id: "class-A", schoolId: "school-A", teacherId: m.classTeacher }, "class-X": { id: "class-X", schoolId: "school-B", teacherId: "teacher-A" } } as Record<string, unknown>)[where.id] ?? null },
  teacherAssignment: { findMany: async () => [] },
  assignment: { findFirst: async ({ where }: { where: { id: string; Class: { schoolId: string } } }) => (where.id === "asg-A" && where.Class.schoolId === "school-A" ? { classId: "class-A" } : null) },
} }));

import { getActiveTeacherAlerts, markAlertReviewed, recordTeacherAlertAction } from "@/lib/intelligence/teacherAlerts";

const alert = (id: string, alertType: string, over: Row = {}): Row => ({ id, teacherUserId: "teacher-A", schoolId: "school-A", status: "ACTIVE", severity: "high",
  alertType, studentId: null, reason: "r", weakConcept: null, weakLesson: null, recommendedAction: null, idempotencyKey: null, createdAt: new Date(), ...over });
const visibleIds = async () => (await getActiveTeacherAlerts("teacher-A", "school-A")).map((a: { id: string }) => a.id).sort();

beforeEach(() => {
  vi.clearAllMocks();
  m.classTeacher = "teacher-A"; m.studentClasses = { "stu-A": ["class-A"] };
  m.update.mockResolvedValue({}); m.create.mockResolvedValue({ id: "act-1" });
  m.rows = [
    alert("student", "INACTIVE_STUDENT", { studentId: "stu-A" }),
    alert("avg", "CLASS_AVERAGE_DROPPED", { idempotencyKey: "teacher-A:CLASS_AVERAGE_DROPPED:class-A:MATH" }),
    alert("missed", "ASSIGNMENT_MISSED_BY_GROUP", { idempotencyKey: "teacher-A:ASSIGNMENT_MISSED_BY_GROUP:asg-A" }),
    alert("weak", "WEAK_TOPIC_SEQUENCE_ADVISED", { idempotencyKey: "teacher-A:WEAK_TOPIC_SEQUENCE_ADVISED:MATH:l1" }),
    alert("gap", "CURRICULUM_GAP_AFFECTING_CLASS", { idempotencyKey: "school-A:CURRICULUM_GAP_AFFECTING_CLASS:c1:weak_lesson" }),
    alert("pace", "PACING_SUPPORT_NEEDED", { idempotencyKey: "teacher-A:PACING_SUPPORT_NEEDED:slow" }),
  ];
});

describe("current class authority", () => {
  it("with authority, every kind is visible", async () => {
    expect(await visibleIds()).toEqual(["avg", "gap", "missed", "pace", "student", "weak"]);
  });
  it("once the class is no longer the teacher's, its student and class alerts disappear; owner-only summaries stay", async () => {
    m.classTeacher = "teacher-new";
    expect(await visibleIds()).toEqual(["gap", "pace", "weak"]);
  });
  it("a hidden alert cannot be reviewed or turned into an action (404, no write)", async () => {
    m.classTeacher = "teacher-new";
    await expect(markAlertReviewed("student", "teacher-A", "school-A")).rejects.toMatchObject({ status: 404 });
    await expect(recordTeacherAlertAction("missed", "teacher-A", "school-A")).rejects.toMatchObject({ status: 404 });
    expect(m.update).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
});

describe("strict key parsing (fail closed)", () => {
  it.each([
    ["a malformed class-average key", "CLASS_AVERAGE_DROPPED", "teacher-A:CLASS_AVERAGE_DROPPED:class-A"],
    ["a class-average key with extra segments", "CLASS_AVERAGE_DROPPED", "teacher-A:CLASS_AVERAGE_DROPPED:class-A:MATH:x"],
    ["another owner's prefix", "CLASS_AVERAGE_DROPPED", "teacher-B:CLASS_AVERAGE_DROPPED:class-A:MATH"],
    ["another school's class", "CLASS_AVERAGE_DROPPED", "teacher-A:CLASS_AVERAGE_DROPPED:class-X:MATH"],
    ["an assignment of another school", "ASSIGNMENT_MISSED_BY_GROUP", "teacher-A:ASSIGNMENT_MISSED_BY_GROUP:asg-other"],
    ["a missing key", "ASSIGNMENT_MISSED_BY_GROUP", null],
  ])("%s is hidden", async (_, alertType, idempotencyKey) => {
    m.rows = [alert("x", alertType, { idempotencyKey })];
    expect(await visibleIds()).toEqual([]);
  });
  it("an unknown alert type is hidden", async () => {
    m.rows = [alert("x", "SOMETHING_NEW")];
    expect(await visibleIds()).toEqual([]);
  });
});
