/**
 * AT-GRADE-01 batch 3, CoS ruling 10 / COS-BATCH3-RULINGS-20261028 B: executeTeacherAction authorizes every handler
 * through lib/authz/classAuthority, with its own target class and function, BEFORE any write (including the lifecycle
 * "confirmed" update):
 * - ASSIGN_REMEDIATION_REVIEW: class.lesson.support on the target class (action class, metadata target class, or a
 *   class of the student), with the action's subject;
 * - PLAN_CLASS_REVIEW / GENERATE_REVIEW_PLAN: class.lesson.support on the action's class; no class means refused;
 * - CREATE_FOLLOW_UP_REMINDER: class.read.learning on its class or a class of its student; with neither, owner-only;
 * - RECORD_FOLLOW_UP / REVIEW_INTERVENTION: class.feedback on a class the student is currently enrolled in;
 * - unknown handlers: refused.
 * Authority is CURRENT: an action created while the teacher held authority is refused once it is gone.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  action: null as null | Record<string, unknown>,
  classTeacher: "teacher-A",
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  studentClasses: ["class-A"] as string[],
  lifecycle: vi.fn(), create: vi.fn(), assignment: vi.fn(), submissions: vi.fn(), intervention: vi.fn(), chain: vi.fn(), planner: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: async () => undefined }));
vi.mock("@/lib/events/logLearningEvent", () => ({ logLearningEvent: async () => undefined }));
vi.mock("@/lib/ai/teacher/lessonPlanner", () => ({ getTeacherLessonPlannerResponse: m.planner }));
vi.mock("@/lib/interventions/interventionChains", () => ({ openInterventionChain: m.chain }));
vi.mock("@/lib/db", () => ({ prisma: {
  teacherAction: { findFirst: async () => m.action, update: m.lifecycle, create: m.create },
  class: {
    findUnique: async ({ where }: { where: { id: string } }) => (where.id === "class-A" ? { id: "class-A", name: "P4 Blue", schoolId: "school-A", teacherId: m.classTeacher } : null),
    findFirst: async ({ where }: { where: { id: string; teacherId?: string } }) => (where.id === "class-A" && (!where.teacherId || where.teacherId === m.classTeacher) ? { id: "class-A", name: "P4 Blue" } : null),
  },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.assignments.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) },
  enrollment: {
    findMany: async () => m.studentClasses.map((classId) => ({ classId })),
    findFirst: async ({ where }: { where: { Class?: { teacherId?: string } } }) => (m.studentClasses.includes("class-A") && (!where.Class?.teacherId || where.Class.teacherId === m.classTeacher) ? { classId: "class-A", Class: { id: "class-A", name: "P4 Blue" } } : null),
  },
  student: { findMany: async () => [{ id: "stu-A" }] },
  curriculumContent: { findUnique: async () => ({ contentId: "content-A", payload: { title: "Fractions" }, moeAlignments: [] }) },
  assignment: { create: m.assignment },
  assignmentSubmission: { createMany: m.submissions },
  interventionRecommendation: { updateMany: m.intervention },
} }));

import { executeTeacherAction } from "@/lib/intelligence/teacherActionExecution";

const ACTION = (actionType: string, over: Record<string, unknown> = {}) => ({ id: "act-1", teacherUserId: "teacher-A", schoolId: "school-A", classId: "class-A", studentId: "stu-A",
  contentId: "content-A", subject: "MATH", actionType, metadata: { action: { status: "ready" } }, ...over });
const run = (teacher = "teacher-A", role = "TEACHER") => executeTeacherAction("act-1", { teacherUserId: teacher, schoolId: "school-A", role } as never);
const noWrites = () => {
  expect(m.lifecycle).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.assignment).not.toHaveBeenCalled();
  expect(m.intervention).not.toHaveBeenCalled(); expect(m.chain).not.toHaveBeenCalled(); expect(m.planner).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  m.classTeacher = "teacher-A"; m.assignments = []; m.studentClasses = ["class-A"];
  m.lifecycle.mockResolvedValue({}); m.create.mockResolvedValue({ id: "new-action" }); m.assignment.mockResolvedValue({ id: "asg-1" });
  m.submissions.mockResolvedValue({ count: 1 }); m.intervention.mockResolvedValue({ count: 1 }); m.chain.mockResolvedValue({ id: "chain-1" }); m.planner.mockResolvedValue({ plan: [] });
});

describe("remediation: class.lesson.support on the target class", () => {
  it("the class teacher executes", async () => {
    m.action = ACTION("ASSIGN_REMEDIATION_REVIEW");
    await expect(run()).resolves.toMatchObject({ handler: "ASSIGN_REMEDIATION_REVIEW" });
    expect(m.assignment).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ classId: "class-A" }) }));
  });
  it("a MATH co-teacher of the class executes a MATH remediation", async () => {
    m.action = ACTION("ASSIGN_REMEDIATION_REVIEW", { teacherUserId: "teacher-co" });
    m.assignments = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A", subject: "MATH" }];
    await expect(run("teacher-co")).resolves.toMatchObject({ handler: "ASSIGN_REMEDIATION_REVIEW" });
  });
  it("once the teacher no longer holds the class, the stored action is refused before any write", async () => {
    m.action = ACTION("ASSIGN_REMEDIATION_REVIEW"); m.classTeacher = "teacher-new";
    await expect(run()).rejects.toMatchObject({ status: 403 });
    noWrites();
  });
});

describe("review plan: class.lesson.support; no class is refused", () => {
  it("with a class and authority it executes", async () => {
    m.action = ACTION("PLAN_CLASS_REVIEW");
    await expect(run()).resolves.toMatchObject({ handler: "PLAN_CLASS_REVIEW" });
  });
  it("without a class it is refused before any write", async () => {
    m.action = ACTION("GENERATE_REVIEW_PLAN", { classId: null, studentId: null });
    await expect(run()).rejects.toMatchObject({ status: 403 });
    noWrites();
  });
});

describe("reminder: class.read.learning when it names a class or student; owner-only otherwise", () => {
  it("with neither class nor student it is allowed for its owner", async () => {
    m.action = ACTION("CREATE_FOLLOW_UP_REMINDER", { classId: null, studentId: null });
    await expect(run()).resolves.toMatchObject({ handler: "CREATE_FOLLOW_UP_REMINDER" });
  });
  it("naming a student the teacher no longer has a class basis for, it is refused before any write", async () => {
    m.action = ACTION("CREATE_FOLLOW_UP_REMINDER", { classId: null }); m.classTeacher = "teacher-new";
    await expect(run()).rejects.toMatchObject({ status: 403 });
    noWrites();
  });
});

describe("intervention: class.feedback on a current class of the student", () => {
  it("the class teacher records it", async () => {
    m.action = ACTION("RECORD_FOLLOW_UP", { classId: null });
    await expect(run()).resolves.toMatchObject({ handler: "RECORD_FOLLOW_UP" });
    expect(m.chain).toHaveBeenCalledTimes(1);
  });
  it("a teacher with no current class basis for the student is refused before any write", async () => {
    m.action = ACTION("REVIEW_INTERVENTION", { classId: null }); m.classTeacher = "teacher-new";
    await expect(run()).rejects.toMatchObject({ status: 403 });
    noWrites();
  });
});

describe("unknown handlers", () => {
  it("are refused before any write (no lifecycle update)", async () => {
    m.action = ACTION("DELETE_EVERYTHING");
    await expect(run()).rejects.toMatchObject({ status: 409 });
    noWrites();
  });
});
