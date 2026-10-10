// Cross-builder P1: a teacher identity is projected only for a teacher of the learner's own school.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), student: vi.fn(), enrollments: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findFirst: mocks.student }, enrollment: { findMany: mocks.enrollments } } }));
import { GET } from "@/app/api/student/my-teachers/route";

const enrollment = (classSchool: string, teacherId: string, teacherSchool: string) => ({ Class: { subject: "MATH", schoolId: classSchool, Teacher: { id: teacherId, name: teacherId.toUpperCase(), schoolId: teacherSchool } } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-a" });
  mocks.student.mockResolvedValue({ id: "student-1" });
});

describe("GET /api/student/my-teachers", () => {
  it("queries own-school enrollments and drops foreign classes and foreign teachers", async () => {
    mocks.enrollments.mockResolvedValue([enrollment("school-a", "own", "school-a"), enrollment("school-a", "foreign-teacher", "school-b"), enrollment("school-b", "foreign-class", "school-b")]);
    const body = await (await GET()).json();
    expect(mocks.enrollments.mock.calls[0][0].where).toEqual({ studentId: "student-1", Class: { schoolId: "school-a" } });
    expect(body).toEqual([{ teacherId: "own", teacherName: "OWN", subject: "MATH" }]);
  });
  it("reads nothing for a learner without a school", async () => {
    mocks.user.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: null });
    expect(await (await GET()).json()).toEqual([]);
    expect(mocks.enrollments).not.toHaveBeenCalled();
  });
});
