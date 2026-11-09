/**
 * AT-GRADE-01: assigned-class authorization for GET /api/teacher/labs/sessions (founder policy, 2026-10-26).
 *
 * - The class's primary teacher (Class.teacherId) reads every lab of that class.
 * - A subject co-teacher reads only labs of the subject their TeacherAssignment covers, for that class only.
 * - An ADMIN of the class's school reads every lab of the class (school-scoped oversight).
 * - A same-school teacher without a class or subject assignment, and anyone from another school, is refused.
 * - No substitute delegation exists; it grants nothing.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Viewer = { id: string; role: "TEACHER" | "ADMIN"; schoolId: string | null };
type Assignment = { schoolId: string; teacherId: string; classId: string; subject: string; isPrimary?: boolean };
const mocks = vi.hoisted(() => ({
  viewer: null as unknown as { id: string; role: string; schoolId: string | null },
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string; isPrimary?: boolean }[],
  assignmentWheres: [] as any[],
  labReads: 0,
}));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => mocks.viewer }));
vi.mock("@/lib/db", () => {
  const at = new Date(0);
  // Every session is scheduled work of class c1, so the record scope (at-grade-01-lab-class-records) keeps it.
  const reviewed = { scheduledWorkId: "w1", startedAt: at, completedAt: at, score: 80, teacherFeedback: "Clear evidence." };
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => row[key] === value);
  return {
    prisma: {
      class: { findUnique: async () => ({ id: "c1", schoolId: "school-a", teacherId: "teacher-primary" }) },
      enrollment: { findMany: async () => [{ Student: { userId: "s1" } }] },
      scheduledWork: { findMany: async () => [{ id: "w1" }] },
      teacherAssignment: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          mocks.assignmentWheres.push(where);
          return mocks.assignments.filter((row) => matches(row, where));
        },
      },
      labSession: {
        findMany: async () => {
          mocks.labReads += 1;
          return [
            { id: "sci", labId: "plant-lab", ...reviewed },
            { id: "math", labId: "fraction-lab", ...reviewed },
            { id: "phys", labId: "pendulum-lab", ...reviewed },
            { id: "orphan", labId: "unregistered-lab", ...reviewed },
          ];
        },
      },
      virtualLab: {
        findMany: async () => [
          { labId: "plant-lab", title: "Plant Growth Lab", subject: "SCIENCE" },
          { labId: "fraction-lab", title: "Fraction Strips Lab", subject: "MATH" },
          { labId: "pendulum-lab", title: "Pendulum Lab", subject: "Physics" },
        ],
      },
    },
  };
});

import { GET } from "@/app/api/teacher/labs/sessions/route";

const call = async (viewer: Viewer) => {
  mocks.viewer = viewer;
  const res = await GET(new Request("http://localhost/api/teacher/labs/sessions?classId=c1") as any);
  const body = await res.json();
  return { status: res.status, labs: (body.sessions ?? []).map((s: { labId: string }) => s.labId).sort() };
};
const ALL_LABS = ["fraction-lab", "pendulum-lab", "plant-lab", "unregistered-lab"];
const coTeacher = (subject: string, over: Partial<Assignment> = {}): Assignment => ({ schoolId: "school-a", teacherId: "teacher-co", classId: "c1", subject, ...over });
const CO: Viewer = { id: "teacher-co", role: "TEACHER", schoolId: "school-a" };

beforeEach(() => { mocks.labReads = 0; mocks.assignments = []; mocks.assignmentWheres = []; });

describe("AT-GRADE-01 lab sessions: whole-class access", () => {
  it("the class's primary teacher reads every lab of the class", async () => {
    expect(await call({ id: "teacher-primary", role: "TEACHER", schoolId: "school-a" })).toEqual({ status: 200, labs: ALL_LABS });
  });
  it("an ADMIN of the class's school reads every lab of the class", async () => {
    expect(await call({ id: "admin-a", role: "ADMIN", schoolId: "school-a" })).toEqual({ status: 200, labs: ALL_LABS });
  });
});

describe("AT-GRADE-01 lab sessions: subject co-teacher", () => {
  it("reads only the labs of the subject assigned for this class", async () => {
    mocks.assignments = [coTeacher("SCIENCE")];
    // "Physics" is free text, not the SCIENCE enum value, so it is withheld (founder decision 3).
    expect(await call(CO)).toEqual({ status: 200, labs: ["plant-lab"] });
  });
  it("two assigned subjects for this class give both subjects' labs", async () => {
    mocks.assignments = [coTeacher("SCIENCE"), coTeacher("MATH")];
    expect(await call(CO)).toEqual({ status: 200, labs: ["fraction-lab", "plant-lab"] });
  });
  it("an assignment for this class in another subject shows none of this class's science or math labs", async () => {
    mocks.assignments = [coTeacher("CIVICS")];
    expect(await call(CO)).toEqual({ status: 200, labs: [] });
  });
  it("an isPrimary subject assignment is still subject-scoped, not whole-class", async () => {
    mocks.assignments = [coTeacher("MATH", { isPrimary: true })];
    expect(await call(CO)).toEqual({ status: 200, labs: ["fraction-lab"] });
  });
  it("a free-text-subject lab, or one with no lab record, is withheld (fail closed)", async () => {
    mocks.assignments = [coTeacher("SCIENCE"), coTeacher("MATH"), coTeacher("ENGINEERING")];
    const { labs } = await call(CO);
    expect(labs).not.toContain("pendulum-lab");
    expect(labs).not.toContain("unregistered-lab");
  });
  it("an assignment to another class in the same subject is not enough", async () => {
    mocks.assignments = [coTeacher("SCIENCE", { classId: "c2" })];
    expect((await call(CO)).status).toBe(403);
    expect(mocks.labReads).toBe(0);
  });
  it("an assignment recorded under another school is not enough, and the lookup is scoped to the viewer's school", async () => {
    mocks.assignments = [coTeacher("SCIENCE", { schoolId: "school-b" })];
    expect((await call(CO)).status).toBe(403);
    expect(mocks.assignmentWheres.every((where) => where.schoolId === "school-a" && where.teacherId === "teacher-co" && where.classId === "c1")).toBe(true);
  });
});

describe("AT-GRADE-01 lab sessions: refused", () => {
  it("a same-school TEACHER not assigned to the class gets 403 and no lab rows are read", async () => {
    expect((await call({ id: "teacher-other", role: "TEACHER", schoolId: "school-a" })).status).toBe(403);
    expect(mocks.labReads).toBe(0);
  });
  it.each<Viewer>([
    { id: "teacher-primary", role: "TEACHER", schoolId: "school-b" },
    { id: "teacher-co", role: "TEACHER", schoolId: "school-b" },
    { id: "teacher-b", role: "TEACHER", schoolId: "school-b" },
    { id: "admin-b", role: "ADMIN", schoolId: "school-b" },
    { id: "teacher-none", role: "TEACHER", schoolId: null },
    { id: "admin-none", role: "ADMIN", schoolId: null },
  ])("cross-school or school-less $role $id ($schoolId) gets 403 and no lab rows are read", async (viewer) => {
    mocks.assignments = [coTeacher("SCIENCE", { schoolId: "school-b" })];
    expect((await call(viewer)).status).toBe(403);
    expect(mocks.labReads).toBe(0);
  });
});
