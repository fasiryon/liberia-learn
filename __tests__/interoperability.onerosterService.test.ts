import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  school: { findUnique: vi.fn() },
  academicYear: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  class: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn() }));
vi.mock("@/lib/queue", () => ({
  enqueueJob: vi.fn(),
  isQueueConfigured: vi.fn().mockReturnValue(false),
  JobType: { ONEROSTER_IMPORT: "ONEROSTER_IMPORT" },
}));

import { buildOneRosterZip, parseOneRosterZip } from "@/lib/interoperability/oneroster";
import { buildSchoolOneRosterData } from "@/lib/interoperability/onerosterService";

beforeEach(() => {
  vi.clearAllMocks();
  db.school.findUnique.mockResolvedValue({ id: "school-1", name: "Kendeja Public School", code: "MOE-77" });
  db.academicYear.findFirst.mockResolvedValue({
    id: "year-2026",
    schoolId: "school-1",
    yearLabel: "2025/2026",
    startDate: new Date("2025-09-01T00:00:00.000Z"),
    endDate: new Date("2026-07-31T00:00:00.000Z"),
    isActive: true,
    terms: [
      {
        id: "term-1",
        name: "Term 1",
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2025-12-19T00:00:00.000Z"),
      },
    ],
  });
  db.user.findMany.mockResolvedValue([
    {
      id: "student-user-1",
      email: "student1@example.org",
      loginId: "student1",
      name: "Martha Doe",
      role: "STUDENT",
      phone: null,
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
      student: { id: "student-1", currentGrade: 6, dateOfBirth: new Date("2013-05-10T00:00:00.000Z"), deletedAt: null },
    },
    {
      id: "teacher-user-1",
      email: "teacher1@example.org",
      loginId: "teacher1",
      name: "Joseph Kollie",
      role: "TEACHER",
      phone: "+231770000001",
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
      student: null,
    },
  ]);
  db.class.findMany.mockResolvedValue([
    {
      id: "class-1",
      name: "Grade 6 Mathematics",
      subject: "MATH",
      gradeLevel: 6,
      teacherId: "teacher-user-1",
      enrollments: [{ id: "enrollment-1", Student: { userId: "student-user-1" } }],
    },
  ]);
});

describe("OneRoster school export service round trip", () => {
  it("preserves real school roster identities and relationships through export and re-import parsing", async () => {
    const exported = await buildSchoolOneRosterData("school-1");
    const parsed = await parseOneRosterZip(await buildOneRosterZip(exported));

    expect(parsed.valid).toBe(true);
    expect(parsed.counts).toMatchObject({ users: 2, classes: 1, enrollments: 2, roles: 2 });
    expect(parsed.rows.orgs[0]).toMatchObject({ name: "Kendeja Public School", identifier: "MOE-77" });

    const student = parsed.rows.users.find((row) => row.username === "student1");
    const teacher = parsed.rows.users.find((row) => row.username === "teacher1");
    const rosterClass = parsed.rows.classes[0];
    expect(student?.userIds).toContain("{liberialearn:student-user-1}");
    expect(teacher?.userIds).toContain("{liberialearn:teacher-user-1}");
    expect(rosterClass.classCode).toBe("class-1");
    expect(parsed.rows.enrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ classSourcedId: rosterClass.sourcedId, userSourcedId: student?.sourcedId, role: "student" }),
      expect.objectContaining({ classSourcedId: rosterClass.sourcedId, userSourcedId: teacher?.sourcedId, role: "teacher", primary: true }),
    ]));
  });
});
