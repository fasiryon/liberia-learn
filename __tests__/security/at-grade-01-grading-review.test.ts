/**
 * AT-GRADE-01: PATCH /api/grading/[submissionId]/override is ADVISORY assessment review (COS-CLASS-AUTHORITY-DESIGN.md
 * section A). It changes only the advisory GradedSubmission, never an official record, and needs:
 * - class.assessment.review for a class the learner is enrolled in, for the lesson's subject (class teacher, subject
 *   co-teacher of that class and subject, or a school ADMIN); same-school membership alone is refused;
 * - a reason; the update and its audit row commit together or not at all;
 * - an essay submission that already carries a successful AI suggestion (the route's documented scope); a pending or
 *   failed AI run is not eligible for ordinary AI-score review (founder decision, 2026-10-27);
 * - no platform-admin bypass: a platform role is not academic authority (founder decision; CoS ruling 3);
 * - no official record and no adaptive mastery write (CoS ruling 5).
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Actor = { id: string; role: string; schoolId: string | null; isPlatformAdmin?: boolean };
const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null; isPlatformAdmin?: boolean },
  submission: null as null | Record<string, unknown>,
  stored: { score: 0.4 as number | null },
  classes: {} as Record<string, { schoolId: string; teacherId: string | null }>,
  enrollments: [] as { classId: string }[],
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  update: vi.fn(), audit: vi.fn(), requiredAudit: vi.fn(), official: vi.fn(), answer: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit, logAuditRequired: m.requiredAudit }));
vi.mock("@/lib/adaptive/updateMastery", () => ({ recordAnswer: m.answer }));
vi.mock("@/lib/db", () => {
  const client = {
    gradedSubmission: { findUnique: async () => m.submission, update: m.update },
    curriculumContent: { findUnique: async () => ({ id: "lesson-A", subject: "ENGLISH" }) },
    enrollment: { findMany: async () => m.enrollments },
    class: { findUnique: async ({ where }: { where: { id: string } }) => m.classes[where.id] ?? null },
    teacherAssignment: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        m.assignments.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)),
    },
    assessmentAttempt: { create: m.official, update: m.official },
    grade: { create: m.official, update: m.official, upsert: m.official },
    reportCard: { update: m.official },
    auditLog: { create: m.official },
    adaptiveMasteryRecord: { create: m.official, update: m.official, upsert: m.official },
  };
  return {
    prisma: {
      ...client,
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) => {
        const before = m.stored.score;
        try { return await operation(client); } catch (error) { m.stored.score = before; throw error; }
      },
    },
  };
});

import { PATCH } from "@/app/api/grading/[submissionId]/override/route";

const essay = (over: Record<string, unknown> = {}) => ({
  id: "submission-A", exerciseType: "essay", status: "graded", score: 0.4, studentId: "student-A", lessonId: "lesson-A",
  student: { user: { schoolId: "school-A" } }, ...over,
});
const call = async (actor: Actor, body: Record<string, unknown> = { score: 0.9, reason: "Rubric criterion 2 is met; the AI missed the evidence." }) => {
  m.actor = actor;
  const res = await PATCH(new Request("http://localhost/api/grading/submission-A/override", { method: "PATCH", body: JSON.stringify(body) }), { params: { submissionId: "submission-A" } });
  return res.status;
};
const noWrites = () => { expect(m.update).not.toHaveBeenCalled(); expect(m.requiredAudit).not.toHaveBeenCalled(); expect(m.official).not.toHaveBeenCalled(); expect(m.answer).not.toHaveBeenCalled(); };
const TEACHER = (id: string, schoolId: string | null = "school-A"): Actor => ({ id, role: "TEACHER", schoolId });

beforeEach(() => {
  vi.clearAllMocks();
  m.submission = essay();
  m.stored = { score: 0.4 };
  m.classes = { "class-A": { schoolId: "school-A", teacherId: "teacher-class" }, "class-B": { schoolId: "school-A", teacherId: "teacher-b" } };
  m.enrollments = [{ classId: "class-A" }];
  m.assignments = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A", subject: "ENGLISH" }];
  m.update.mockImplementation(async ({ data }: { data: { score: number } }) => { m.stored.score = data.score; return { id: "submission-A", ...data }; });
  m.requiredAudit.mockResolvedValue(undefined);
  m.audit.mockResolvedValue(true);
});

describe("allowed advisory review (writes only the GradedSubmission, with an audit in the same transaction)", () => {
  it.each<[string, Actor]>([
    ["the learner's class teacher", TEACHER("teacher-class")],
    ["an English co-teacher of the learner's class", TEACHER("teacher-co")],
    ["an ADMIN of the school", { id: "admin-A", role: "ADMIN", schoolId: "school-A" }],
  ])("%s", async (_, actor) => {
    expect(await call(actor)).toBe(200);
    expect(m.stored.score).toBe(0.9);
    expect(m.requiredAudit).toHaveBeenCalledTimes(1);
    const [entry, client] = m.requiredAudit.mock.calls[0]!;
    expect(entry).toMatchObject({ userId: actor.id, schoolId: "school-A", action: "grading.submission.override",
      details: expect.objectContaining({ previousScore: 0.4, newScore: 0.9, reason: "Rubric criterion 2 is met; the AI missed the evidence." }) });
    expect(client).toBeDefined();
    expect(m.official).not.toHaveBeenCalled();
    expect(m.answer).not.toHaveBeenCalled();
  });
});

describe("no platform-admin bypass (refused before any write)", () => {
  it("a platform admin with no school", async () => {
    expect(await call({ id: "platform-1", role: "ADMIN", schoolId: null, isPlatformAdmin: true })).toBe(403); noWrites();
  });
  it("a platform admin from another school", async () => {
    expect(await call({ id: "platform-2", role: "ADMIN", schoolId: "school-B", isPlatformAdmin: true })).toBe(403); noWrites();
  });
  it("a platform-flagged teacher of the learner's school with no class basis", async () => {
    expect(await call({ ...TEACHER("teacher-other"), isPlatformAdmin: true })).toBe(403); noWrites();
  });
});

describe("refused before any write", () => {
  it("a same-school teacher with no class or subject assignment", async () => {
    expect(await call(TEACHER("teacher-other"))).toBe(403); noWrites();
  });
  it("a co-teacher of the learner's class for another subject", async () => {
    m.assignments = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-A", subject: "MATH" }];
    expect(await call(TEACHER("teacher-co"))).toBe(403); noWrites();
  });
  it("the teacher of a class the learner is not enrolled in", async () => {
    expect(await call(TEACHER("teacher-b"))).toBe(403); noWrites();
  });
  it("a learner in no class gives no class teacher a basis", async () => {
    m.enrollments = [];
    expect(await call(TEACHER("teacher-class"))).toBe(403); noWrites();
  });
  it("cross-school teacher and ADMIN", async () => {
    expect(await call(TEACHER("teacher-class", "school-B"))).toBe(403); noWrites();
    expect(await call({ id: "admin-B", role: "ADMIN", schoolId: "school-B" })).toBe(403); noWrites();
  });
  it("an unbound teacher and an unbound learner (null never equals null)", async () => {
    m.submission = essay({ student: { user: { schoolId: null } } });
    expect(await call(TEACHER("teacher-class", null))).toBe(403); noWrites();
  });
  it("a missing or blank reason", async () => {
    expect(await call(TEACHER("teacher-class"), { score: 0.9 })).toBe(400); noWrites();
    expect(await call(TEACHER("teacher-class"), { score: 0.9, reason: "   " })).toBe(400); noWrites();
  });
  it("a code submission (the route reviews AI essay suggestions only)", async () => {
    m.submission = essay({ exerciseType: "code" });
    expect(await call(TEACHER("teacher-class"))).toBe(409); noWrites();
  });
  it("a failed AI run, even one that still carries a score", async () => {
    m.submission = essay({ status: "failed", score: 0.2 });
    expect(await call(TEACHER("teacher-class"))).toBe(409); noWrites();
  });
  it("a pending submission with no AI suggestion yet", async () => {
    m.submission = essay({ status: "pending", score: null });
    expect(await call(TEACHER("teacher-class"))).toBe(409); noWrites();
  });
});

describe("the update and its audit commit together", () => {
  it("an audit failure reports an error and leaves the advisory score unchanged", async () => {
    m.requiredAudit.mockRejectedValue(new Error("synthetic audit unavailable"));
    expect(await call(TEACHER("teacher-class"))).toBeGreaterThanOrEqual(500);
    expect(m.stored.score).toBe(0.4);
  });
});
