import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ student: vi.fn(), timetable: vi.fn(), work: vi.fn(), role: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: mocks.student },
  timetable: { findMany: mocks.timetable }, scheduledWork: { findMany: mocks.work } } }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/student/learnDiscovery.server", () => ({ learnerDiscoverySelect: { contentId: true } }));
import { loadStudentClasses } from "@/lib/student/enrollmentReadModel";
import { loadStudentSchedule } from "@/lib/student/scheduleReadModel";
import { GET as list } from "@/app/api/student/classes/route";
import { GET as detail } from "@/app/api/student/classes/[classId]/route";
import { GET as schedule } from "@/app/api/student/schedule/route";

const user = { id: "user", schoolId: "school" };
const classRow = { id: "class", name: "Science A", subject: "SCIENCE", gradeLevel: 8, schoolId: "school",
  Teacher: { name: "Teacher", schoolId: "school" }, School: { name: "School" } };
const student = () => ({ id: "student", deletedAt: null, user: { schoolId: "school" }, academicEnrollments: [],
  enrollments: [{ Class: classRow }] });
const getDetail = (classId = "class") => detail(new Request("http://localhost"), { params: { classId } });
beforeEach(() => { vi.clearAllMocks(); mocks.student.mockResolvedValue(student()); mocks.role.mockResolvedValue(user);
  mocks.timetable.mockResolvedValue([]); mocks.work.mockResolvedValue([]); });

describe("student class read authority", () => {
  it.each([401, 403])("denies anonymous/wrong-role callers (%s) before data lookup", async (status) => {
    mocks.role.mockRejectedValue({ status });
    expect((await list()).status).toBe(status); expect((await getDetail()).status).toBe(status);
    expect((await schedule()).status).toBe(status); expect(mocks.student).not.toHaveBeenCalled();
  });
  it("projects enrolled classes and matches detail exactly", async () => {
    const listing = await (await list()).json(); const single = await (await getDetail()).json();
    expect(listing.classes).toEqual([single.class]);
    expect(single.class).toEqual({ classId: "class", className: "Science A", subject: "SCIENCE", grade: 8, teacher: "Teacher", school: "School" });
    expect(mocks.student.mock.calls[1][0].select.enrollments.where).toEqual({ classId: "class", Class: { schoolId: "school" } });
  });
  it.each(["same-school-unenrolled", "unknown"])("denies %s even with matching grade/subject", async (id) => {
    expect((await getDetail(id)).status).toBe(404);
  });
  it("denies a foreign-school class and stale user school", async () => {
    mocks.student.mockResolvedValue({ ...student(), enrollments: [{ Class: { ...classRow, schoolId: "foreign" } }] });
    expect((await getDetail()).status).toBe(404);
    mocks.student.mockResolvedValue({ ...student(), user: { schoolId: "foreign" } });
    expect(await loadStudentClasses(user)).toEqual([]);
  });
  it("denies deleted/missing student and absent school", async () => {
    mocks.student.mockResolvedValue({ ...student(), deletedAt: new Date() }); expect((await getDetail()).status).toBe(404);
    mocks.student.mockResolvedValue(null); expect((await getDetail()).status).toBe(404);
    expect(await loadStudentClasses({ id: "user" })).toEqual([]);
  });
  it.each(["COMPLETED", "PROMOTED", "RETAINED", "TRANSFERRED", "GRADUATED"])("denies stale academic status %s", async (status) => {
    mocks.student.mockResolvedValue({ ...student(), academicEnrollments: [{ schoolId: "school", status,
      academicYear: { isActive: true, startDate: new Date(0), endDate: new Date("2099-01-01") } }] });
    expect((await getDetail()).status).toBe(404);
  });
  it("denies expired academic year, accepts current active academic enrollment", async () => {
    const academicYear = { isActive: true, startDate: new Date(0), endDate: new Date(1) };
    mocks.student.mockResolvedValue({ ...student(), academicEnrollments: [{ schoolId: "school", status: "ACTIVE", academicYear }] });
    expect((await getDetail()).status).toBe(404);
    academicYear.endDate = new Date("2099-01-01"); expect((await getDetail()).status).toBe(200);
  });
  it("does not expose a teacher name from another school", async () => {
    mocks.student.mockResolvedValue({ ...student(), enrollments: [{ Class: { ...classRow, Teacher: { name: "FOREIGN", schoolId: "other" } } }] });
    expect((await loadStudentClasses(user))[0].teacher).toBeNull();
  });
  it("revoking the exact roster row revokes class detail", async () => {
    mocks.student.mockResolvedValue({ ...student(), enrollments: [] });
    expect((await getDetail()).status).toBe(404);
  });
});

describe("existing schedule authority", () => {
  it("returns real recurring periods with tenant/enrollment query boundaries", async () => {
    const period = { id: "period", classId: "class", dayOfWeek: "MONDAY", periodLabel: "1", startTime: "08:00", endTime: "09:00", room: null };
    mocks.timetable.mockResolvedValue([period]);
    const result = await loadStudentSchedule(user);
    expect(result).toMatchObject({ availability: "configured", periods: [period], freshness: "current" });
    expect(mocks.timetable.mock.calls[0][0].where).toEqual({ schoolId: "school", classId: { in: ["class"] }, class: { schoolId: "school" } });
  });
  it("distinguishes no schedule from unavailable", async () => {
    expect(await (await schedule()).json()).toMatchObject({ availability: "no_schedule_configured" });
    mocks.timetable.mockRejectedValue(new Error("database internal secret")); const response = await schedule();
    expect(response.status).toBe(503); const body = await response.json();
    expect(body.availability).toBe("unavailable"); expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("never reads schedule for a learner without enrolled classes", async () => {
    mocks.student.mockResolvedValue({ ...student(), enrollments: [] });
    expect((await loadStudentSchedule(user)).periods).toEqual([]); expect(mocks.timetable).not.toHaveBeenCalled();
  });
  it("advertises lesson actions only after curriculum and tenant authorization", async () => {
    const content = { contentId: "lesson", status: "published", visibility: "public", payload: {}, schoolId: null,
      teacherCreated: false, versionId: null, curriculumVersion: null, provenance: null };
    const row = { id: "work", classId: "class", scheduledDate: new Date(), startTime: null, endTime: null, periodNumber: null, content };
    mocks.work.mockResolvedValue([row, { ...row, id: "foreign", content: { ...content, schoolId: "other" } },
      { ...row, id: "draft", content: { ...content, status: "draft" } },
      { ...row, id: "hidden", content: { ...content, payload: { teacherOnly: true } } }]);
    const result = await loadStudentSchedule(user);
    expect(result.scheduledWork.map((w) => w.action)).toEqual([{ kind: "lesson", href: "/student/work/work" }, null, null, null]);
    expect(JSON.stringify(result)).not.toContain("teacherOnly");
    expect(mocks.work.mock.calls[0][0].where).toMatchObject({ classId: { in: ["class"] }, class: { schoolId: "school" },
      OR: [{ status: null }, { status: "confirmed" }] });
  });
  it("bounds recurring results and reports truncation", async () => {
    mocks.timetable.mockResolvedValue(Array.from({ length: 201 }, (_, id) => ({ id })));
    const result = await loadStudentSchedule(user); expect(result.periods).toHaveLength(200);
    expect(result).toMatchObject({ limits: { truncated: true } });
  });
});
