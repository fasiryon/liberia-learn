/**
 * AT-GRADE-01 batch 3, CoS rulings 7 and 8 (COS-ACCESS-REMEDIATION-RULINGS.md), through lib/authz/classAuthority.
 * (7) Attendance (GET roster/list, POST upsert): the class teacher and an ADMIN of the class's school only. A subject
 *     co-teacher (TeacherAssignment) or a timetable-only teacher may not take attendance (no delegation exists).
 *     Refused with 403 before the roster is read or any attendance is written.
 * (8) learning-authority/grade4-math (misconceptions GET/POST, next-action POST): a teacher reaches a learner only
 *     through a class the learner is enrolled in where the service grants class.read.learning with subject MATH (the
 *     class teacher, or a co-teacher assigned MATH for that class). A SCIENCE co-teacher or a timetable-only teacher
 *     gets the non-disclosing 404. An ADMIN stays school-scoped.
 * Replaces the parallel teacher-scope helper listAuthorizedClassIdsForTeacher (Class.teacherId, any TeacherAssignment,
 * any Timetable) in these routes. Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null },
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  timetables: [] as { schoolId: string; teacherId: string; classId: string }[],
  rosterReads: 0, upsert: vi.fn(), decide: vi.fn(), review: vi.fn(), audit: vi.fn(),
}));
const CLASSES = [
  { id: "class-A", name: "P4 Blue", subject: "MATH", schoolId: "school-A", teacherId: "teacher-A" },
  { id: "class-C", name: "Other school", subject: "MATH", schoolId: "school-B", teacherId: "teacher-C" },
];
const matchRow = (row: Record<string, unknown>, where: Record<string, any> = {}) => Object.entries(where).every(([k, v]) =>
  v === undefined || (v && typeof v === "object" && "in" in v ? v.in.includes(row[k]) : row[k] === v));

vi.mock("@/lib/auth", () => ({
  requireUser: async () => m.actor,
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit, logAuditRequired: m.audit }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: async () => undefined }));
vi.mock("@/lib/policy/policyEngine", () => ({ validateAttendanceCompliance: async () => undefined }));
vi.mock("@/lib/autonomous/signals/productSignalService", () => ({ logProductSignal: async () => undefined }));
vi.mock("@/lib/learning-authority/governedGrade4Math", () => ({ GRADE4_MATH_ONTOLOGY_RELEASE: { id: "rel", concepts: [{ id: "c1" }] }, deterministicReleaseIdentity: () => "rel-id" }));
vi.mock("@/lib/learning-state/masteryWriter", () => ({
  readCanonicalStudentConceptState: async () => ({ scope: { conceptId: "c1" }, misconceptions: [] }),
  appendGovernedMisconceptionReview: m.review,
}));
vi.mock("@/lib/learning-state/misconceptionPolicy", () => ({ GRADE4_MATH_MISCONCEPTION_POLICY: { signals: [] } }));
vi.mock("@/lib/learning-state/studentLearningModel", () => ({ toDecisionModelLearnerState: () => ({}) }));
vi.mock("@/lib/learning-authority/learningDecisionStore", () => ({ decideGrade4LearningAction: m.decide }));
vi.mock("@/lib/db", () => ({ prisma: {
  class: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => CLASSES.filter((c) => matchRow(c, where)).map(({ id, name, subject }) => ({ id, name, subject })),
    findUnique: async ({ where }: { where: { id: string } }) => CLASSES.find((c) => c.id === where.id) ?? null,
  },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.assignments.filter((r) => matchRow(r, where)) },
  timetable: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.timetables.filter((r) => matchRow(r, where)) },
  enrollment: { findMany: async () => { m.rosterReads += 1; return [{ studentId: "stu-A", Student: { id: "stu-A", currentGrade: 4, user: { name: "L", email: null } } }]; } },
  attendance: { findMany: async () => [], upsert: m.upsert },
  $transaction: async (ops: unknown[]) => ops,
  studentGuardian: { findMany: async () => [] },
  school: { findUnique: async () => ({ districtId: null }) },
  student: {
    findFirst: async ({ where }: { where: Record<string, any> }) => {
      if (where.id !== "stu-A") return null;
      if (where.user?.schoolId && where.user.schoolId !== "school-A") return null;
      if (where.currentGrade !== undefined && where.currentGrade !== 4) return null;
      const allowed = where.enrollments?.some?.Class?.id?.in;
      if (allowed && !allowed.includes("class-A")) return null;
      return { id: "stu-A", userId: "stu-user-A", enrollments: [{ classId: "class-A", Class: { schoolId: "school-A" } }] };
    },
  },
} }));

import { GET as attendanceGet, POST as attendancePost } from "@/app/api/teacher/attendance/route";
import { GET as misconceptionsGet } from "@/app/api/teacher/learning-authority/grade4-math/misconceptions/route";
import { POST as nextActionPost } from "@/app/api/teacher/learning-authority/grade4-math/next-action/route";

const T = (id: string, schoolId: string | null = "school-A") => ({ id, role: "TEACHER", schoolId });
const ADMIN = { id: "admin-A", role: "ADMIN", schoolId: "school-A" };
const listAttendance = async (actor: typeof m.actor, classId?: string) => {
  m.actor = actor;
  const res = await attendanceGet({ url: `http://localhost/api/teacher/attendance${classId ? `?classId=${classId}` : ""}` } as never);
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};
const takeAttendance = async (actor: typeof m.actor) => {
  m.actor = actor;
  const res = await attendancePost({ json: async () => ({ classId: "class-A", date: "2026-10-28", records: [{ studentId: "stu-A", status: "PRESENT" }] }) } as never);
  return res.status;
};
const readMisconceptions = async (actor: typeof m.actor) => {
  m.actor = actor;
  const res = await misconceptionsGet({ nextUrl: new URL("http://localhost/x?studentId=stu-A") } as never);
  return res.status;
};
const override = async (actor: typeof m.actor) => {
  m.actor = actor;
  const res = await nextActionPost({ json: async () => ({ studentId: "stu-A", candidateId: "cand-1", reason: "Needs place value first.", idempotencyKey: "k-1" }) } as never);
  return res.status;
};
const co = (subject: string) => ({ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A", subject });

beforeEach(() => {
  vi.clearAllMocks();
  m.assignments = []; m.timetables = []; m.rosterReads = 0;
  m.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => ({ id: "att-1", ...args.create, status: "PRESENT" }));
  m.decide.mockResolvedValue({ decision: { id: "d1", action: "REVIEW", learnerStateRevision: 1 }, resolution: { teacherOverride: true }, duplicate: false });
});

describe("(7) attendance: class teacher and school ADMIN only", () => {
  it.each([["the class teacher", T("teacher-A")], ["an ADMIN of the class's school", ADMIN]])("%s reads the roster and takes attendance", async (_, actor) => {
    const { status, body } = await listAttendance(actor, "class-A");
    expect(status).toBe(200);
    expect(body.roster).toHaveLength(1);
    expect(await takeAttendance(actor)).toBe(200);
  });
  it.each([["a MATH co-teacher of the class", () => { m.assignments = [co("MATH")]; }], ["a timetable-only teacher", () => { m.timetables = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A" }]; }]])(
    "%s is refused (403) before the roster is read or attendance written", async (_, arrange) => {
      arrange();
      expect((await listAttendance(T("teacher-co"), "class-A")).status).toBe(403);
      expect(await takeAttendance(T("teacher-co"))).toBe(403);
      expect(m.rosterReads).toBe(0);
      expect(m.upsert).not.toHaveBeenCalled();
    });
  it("the class list offers only classes where the teacher may take attendance", async () => {
    m.assignments = [co("MATH")];
    expect((await listAttendance(T("teacher-co"))).body.classes).toEqual([]);
    expect((await listAttendance(T("teacher-A"))).body.classes.map((c: { id: string }) => c.id)).toEqual(["class-A"]);
  });
  it("another school's class is refused", async () => {
    expect((await listAttendance(T("teacher-A"), "class-C")).status).toBe(403);
    expect(m.rosterReads).toBe(0);
  });
});

describe("(8) grade4-math: class teacher or a MATH co-teacher of the learner's class", () => {
  it.each([["the class teacher", () => {}, "teacher-A"], ["a MATH co-teacher of that class", () => { m.assignments = [co("MATH")]; }, "teacher-co"]])(
    "%s reads misconceptions and records an override", async (_, arrange, id) => {
      arrange();
      expect(await readMisconceptions(T(id))).toBe(200);
      expect(await override(T(id))).toBe(200);
      expect(m.decide).toHaveBeenCalledTimes(1);
    });
  it.each([["a SCIENCE co-teacher of that class", () => { m.assignments = [co("SCIENCE")]; }], ["a timetable-only teacher", () => { m.timetables = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A" }]; }],
    ["a same-school teacher with no class basis", () => {}]])("%s gets the non-disclosing 404 and no override", async (_, arrange) => {
    arrange();
    expect(await readMisconceptions(T("teacher-co"))).toBe(404);
    expect(await override(T("teacher-co"))).toBe(404);
    expect(m.decide).not.toHaveBeenCalled();
  });
  it("an ADMIN stays school-scoped", async () => {
    expect(await readMisconceptions(ADMIN)).toBe(200);
    expect(await readMisconceptions({ id: "admin-B", role: "ADMIN", schoolId: "school-B" })).toBe(404);
  });
});
