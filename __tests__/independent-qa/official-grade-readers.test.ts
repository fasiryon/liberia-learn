import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  role: vi.fn(), classes: vi.fn(), classFirst: vi.fn(), enrollment: vi.fn(), assignments: vi.fn(), submissions: vi.fn(), student: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireRole: db.role }));
vi.mock("@/lib/db", () => ({ prisma: {
  class: { findMany: db.classes, findFirst: db.classFirst }, enrollment: { findMany: db.enrollment }, assignment: { findMany: db.assignments },
  assignmentSubmission: { findMany: db.submissions }, student: { findUnique: db.student },
} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/assignment-notifications", () => ({ notifyAssignmentCreated: vi.fn() }));
vi.mock("@/lib/notifications/inboxService", () => ({ createInboxNotification: vi.fn() }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToMany: vi.fn() }));
vi.mock("@/lib/assignments/targeting", () => ({
  listAssignmentTargeting: vi.fn(async () => new Map()), isAssignmentVisibleToStudent: () => true,
}));

import { GET as gradebook } from "@/app/api/teacher/gradebook/route";
import { GET as teacherAssignments } from "@/app/api/teacher/assignments/route";
import { GET as studentAssignments } from "@/app/api/student/assignments/route";
import { GET as exportGradebook } from "@/app/api/teacher/gradebook/export/route";

const release = new Date("2026-10-01T00:00:00Z");
const before = new Date("2026-09-30T00:00:00Z");
const after = new Date("2026-10-02T00:00:00Z");
const cases = [
  { name: "historical automatic AI release", score: 91, aiGrade: 91, teacherApproved: false, gradedBy: null, gradedAt: release, autoReleasedAt: release, official: null },
  { name: "unmoderated AI score", score: 91, aiGrade: 91, teacherApproved: false, gradedBy: null, gradedAt: before, autoReleasedAt: null, official: null },
  { name: "AI release overwrote an earlier teacher score", score: 91, aiGrade: 91, teacherApproved: false, gradedBy: "qa-teacher", gradedAt: release, autoReleasedAt: release, official: null },
  { name: "teacher approved the suggestion", score: 91, aiGrade: 91, teacherApproved: true, gradedBy: "qa-teacher", gradedAt: release, autoReleasedAt: release, official: 91 },
  { name: "teacher regraded after release", score: 83, aiGrade: 91, teacherApproved: false, gradedBy: "qa-teacher", gradedAt: after, autoReleasedAt: release, official: 83 },
  { name: "manual teacher score", score: 0, aiGrade: null, teacherApproved: false, gradedBy: "qa-teacher", gradedAt: before, autoReleasedAt: null, official: 0 },
];

describe("official assignment projections preserve history without promoting provisional scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.role.mockResolvedValue({ id: "qa-teacher", role: "TEACHER", schoolId: "qa-school" });
    db.classes.mockResolvedValue([{ id: "qa-class", name: "QA Class", subject: "MATH" }]);
    db.classFirst.mockResolvedValue({ id: "qa-class", name: "QA Class" });
    db.enrollment.mockResolvedValue([{ Student: { id: "qa-student", user: { name: "QA Learner" } } }]);
    db.student.mockResolvedValue({ id: "qa-student", enrollments: [{ classId: "qa-class" }] });
  });

  function fixture(input: typeof cases[number]) {
    const submission = { ...input, id: "qa-submission", studentId: "qa-student", assignmentId: "qa-assignment",
      turnedInAt: before, feedback: "Private scoring feedback", aiFeedback: "Provisional suggestion",
      Student: { id: "qa-student", user: { name: "QA Learner", email: "learner@example.invalid" } },
      Assignment: { id: "qa-assignment", title: "QA Task", points: 100, dueAt: null,
        Class: { id: "qa-class", name: "QA Class", subject: "MATH" } },
    };
    db.submissions.mockResolvedValue([submission]);
    db.assignments.mockResolvedValue([{ id: "qa-assignment", title: "QA Task", points: 100, classId: "qa-class",
      createdAt: before, dueAt: null, submissions: [submission],
      Class: { id: "qa-class", name: "QA Class", subject: "MATH", Teacher: { name: "QA Teacher" },
        enrollments: [{ Student: { id: "qa-student", user: { name: "QA Learner" } } }] },
    }]);
    return submission;
  }

  it.each(cases)("gradebook handles $name", async input => {
    const source = fixture(input);
    const response = await gradebook(new NextRequest("http://localhost/api/teacher/gradebook?classId=qa-class"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submissions[0].grade).toBe(input.official);
    expect(body.submissions[0].aiGrade).toBe(input.aiGrade);
    expect(source.score).toBe(input.score);
  });

  it.each(cases)("teacher summary handles $name", async input => {
    fixture(input);
    const response = await teacherAssignments();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.submissions[0].score).toBe(input.official);
    expect(body.assignments[0].averageScore).toBe(input.official);
    expect(body.assignments[0].gradedCount).toBe(input.official === null ? 0 : 1);
    expect(body.assignments[0].submittedCount).toBe(1);
  });

  it.each(cases)("student assignment list handles $name", async input => {
    fixture(input);
    db.role.mockResolvedValue({ id: "qa-student-user", role: "STUDENT", schoolId: "qa-school" });
    const response = await studentAssignments(new NextRequest("http://localhost/api/student/assignments"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assignments[0].submission.score).toBe(input.official);
    expect(body.assignments[0].submission.turnedInAt).toBe(before.toISOString());
    expect(JSON.stringify(body)).not.toContain("aiGrade");
  });

  it.each(cases)("gradebook CSV handles $name", async input => {
    fixture(input);
    const response = await exportGradebook(new NextRequest("http://localhost/api/teacher/gradebook/export?classId=qa-class"));
    expect(response.status).toBe(200);
    const csv = await response.text();
    const row = csv.split("\n")[1];
    expect(row).toBe(input.official === null ? '"QA Learner",,' : `"QA Learner",${input.official},${input.official}`);
    expect(db.classFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "qa-class", schoolId: "qa-school", teacherId: "qa-teacher" } }));
  });
});
