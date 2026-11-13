/**
 * Class-authority service matrix (COS-CLASS-AUTHORITY-DESIGN.md section A, AT-GRADE-01). Synthetic identities and
 * mocks only; the service only reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  classes: {} as Record<string, { schoolId: string; teacherId: string | null }>,
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findUnique: async ({ where }: { where: { id: string } }) => mocks.classes[where.id] ?? null },
    teacherAssignment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        mocks.assignments.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)),
    },
  },
}));

import { authorizeClassAccess, CLASS_FUNCTIONS, SECTION_C_FUNCTIONS } from "@/lib/authz/classAuthority";

const teacher = (id: string, schoolId: string | null = "school-a") => ({ id, role: "TEACHER" as const, schoolId });
const admin = (id: string, schoolId: string | null = "school-a") => ({ id, role: "ADMIN" as const, schoolId });
const read = { classId: "c1", fn: "class.read.learning" as const };

beforeEach(() => {
  mocks.classes = { c1: { schoolId: "school-a", teacherId: "teacher-primary" }, c2: { schoolId: "school-a", teacherId: null } };
  mocks.assignments = [{ schoolId: "school-a", teacherId: "teacher-co", classId: "c1", subject: "SCIENCE" }];
});

describe("allowed, with its basis", () => {
  it.each(CLASS_FUNCTIONS)("%s: the class teacher and a school ADMIN", async (fn) => {
    expect(await authorizeClassAccess(teacher("teacher-primary"), { classId: "c1", fn })).toEqual({ allowed: true, basis: "CLASS_TEACHER" });
    expect(await authorizeClassAccess(admin("admin-a"), { classId: "c1", fn })).toEqual({ allowed: true, basis: "SCHOOL_ADMIN" });
  });
  it.each(CLASS_FUNCTIONS)("%s: a co-teacher for the assigned subject only", async (fn) => {
    expect(await authorizeClassAccess(teacher("teacher-co"), { classId: "c1", fn, subject: "SCIENCE" })).toEqual({ allowed: true, basis: "SUBJECT_ASSIGNMENT" });
    expect(await authorizeClassAccess(teacher("teacher-co"), { classId: "c1", fn, subject: " science " })).toEqual({ allowed: true, basis: "SUBJECT_ASSIGNMENT" });
  });
});

describe("denied, with its reason", () => {
  it("a co-teacher: another subject, a missing subject, an unrecognised subject, another class", async () => {
    expect(await authorizeClassAccess(teacher("teacher-co"), { ...read, subject: "MATH" })).toEqual({ allowed: false, reason: "subject_not_assigned" });
    expect(await authorizeClassAccess(teacher("teacher-co"), read)).toEqual({ allowed: false, reason: "subject_required" });
    expect(await authorizeClassAccess(teacher("teacher-co"), { ...read, subject: "Physics" })).toEqual({ allowed: false, reason: "subject_not_assigned" });
    expect(await authorizeClassAccess(teacher("teacher-co"), { classId: "c2", fn: "class.read.learning", subject: "SCIENCE" })).toEqual({ allowed: false, reason: "no_class_assignment" });
  });
  it("a same-school teacher with no assignment", async () => {
    expect(await authorizeClassAccess(teacher("teacher-other"), { ...read, subject: "SCIENCE" })).toEqual({ allowed: false, reason: "no_class_assignment" });
  });
  it("a class with no primary teacher never matches a viewer by a null id", async () => {
    expect(await authorizeClassAccess(teacher("teacher-other"), { classId: "c2", fn: "class.read.learning" })).toEqual({ allowed: false, reason: "no_class_assignment" });
  });
  it("other school, null school, missing class", async () => {
    expect(await authorizeClassAccess(teacher("teacher-primary", "school-b"), read)).toEqual({ allowed: false, reason: "cross_school" });
    expect(await authorizeClassAccess(admin("admin-b", "school-b"), read)).toEqual({ allowed: false, reason: "cross_school" });
    expect(await authorizeClassAccess(teacher("teacher-primary", null), read)).toEqual({ allowed: false, reason: "no_viewer_school" });
    expect(await authorizeClassAccess(admin("admin-none", null), read)).toEqual({ allowed: false, reason: "no_viewer_school" });
    expect(await authorizeClassAccess(admin("admin-a"), { classId: "missing", fn: "class.read.learning" })).toEqual({ allowed: false, reason: "class_missing" });
  });
  it("a co-teacher assignment recorded under another school does not count", async () => {
    mocks.assignments = [{ schoolId: "school-b", teacherId: "teacher-co", classId: "c1", subject: "SCIENCE" }];
    expect(await authorizeClassAccess(teacher("teacher-co"), { ...read, subject: "SCIENCE" })).toEqual({ allowed: false, reason: "no_class_assignment" });
  });
  it.each(SECTION_C_FUNCTIONS)("%s is denied to everyone, the class teacher and a school ADMIN included", async (fn) => {
    for (const user of [teacher("teacher-primary"), admin("admin-a"), teacher("teacher-co")]) {
      expect(await authorizeClassAccess(user, { classId: "c1", fn, subject: "SCIENCE" })).toEqual({ allowed: false, reason: "official_function_not_available" });
    }
  });
  it("roles other than TEACHER and ADMIN have no class basis", async () => {
    for (const role of ["STUDENT", "GUARDIAN", "DISTRICT_ADMIN", "MOE_OFFICIAL"] as const) {
      expect(await authorizeClassAccess({ id: "teacher-primary", role, schoolId: "school-a" }, read)).toEqual({ allowed: false, reason: "role_not_permitted" });
    }
  });
});
