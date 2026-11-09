/**
 * AT-GRADE-01 batches 2a and 2b, T1 supplement to Atlas d32bc1db (atlas-assessment-analytics-authority,
 * atlas-scheduled-lab-authority). Cases Atlas does not cover:
 * - analytics: a subject co-teacher reads only their class's attempts, only for the content's subject; attempts with
 *   no class are never in a teacher's view; a cross-school ADMIN reads nothing of another school.
 * - scheduled lab: a co-teacher of the class and the lab's exact subject may link it; a free-text lab subject grants a
 *   co-teacher nothing (founder decision 3); a cross-school ADMIN is refused before the roster is read.
 * - the service names the write: class.lesson.support (D1 "lesson support").
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Actor = { id: string; role: string; schoolId: string | null };
const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null },
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  lab: null as null | Record<string, unknown>,
  attemptWheres: [] as Record<string, unknown>[],
  roster: vi.fn(), create: vi.fn(), update: vi.fn(),
}));
const CLASSES: Record<string, { id: string; schoolId: string; teacherId: string }> = {
  "class-A": { id: "class-A", schoolId: "school-A", teacherId: "teacher-A" },
  "class-B": { id: "class-B", schoolId: "school-A", teacherId: "teacher-B" },
};
const ATTEMPTS = [
  { schoolId: "school-A", classId: "class-A", score: 0.8, answer: "answer-A" },
  { schoolId: "school-A", classId: "class-B", score: 0.4, answer: "answer-B" },
  { schoolId: "school-A", classId: null, score: 0.0, answer: "answer-unclassed" },
  { schoolId: "school-B", classId: "class-C", score: 0.1, answer: "answer-C" },
];
const pick = (where: Record<string, any> = {}) => ATTEMPTS.filter((a) =>
  (where.schoolId === undefined || a.schoolId === where.schoolId) &&
  (where.classId === undefined || (where.classId?.in ? where.classId.in.includes(a.classId) : a.classId === where.classId)));
const rowsMatching = (where: Record<string, unknown>, assignments: typeof m.assignments) => assignments.filter((row) =>
  Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));

vi.mock("@/lib/auth", () => ({
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => true, logAuditRequired: async () => undefined }));
vi.mock("@/lib/db", () => ({ prisma: {
  curriculumContent: { findUnique: async () => ({ contentId: "content-A", title: "Synthetic", subject: "SCIENCE", grade: 4 }) },
  class: {
    findUnique: async ({ where }: { where: { id: string } }) => CLASSES[where.id] ?? null,
    findMany: async ({ where }: { where: { schoolId?: string; teacherId?: string } }) => Object.values(CLASSES).filter((c) =>
      (!where.teacherId || c.teacherId === where.teacherId) && (!where.schoolId || c.schoolId === where.schoolId)),
  },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => rowsMatching(where, m.assignments) },
  assessmentAttemptDetail: { findMany: async ({ where }: { where: { attempt: Record<string, unknown> } }) => {
    m.attemptWheres.push(where.attempt);
    return pick(where.attempt).map((a) => ({ questionIdx: 0, questionText: "Synthetic question", selectedAnswer: a.answer, isCorrect: a.score > 0.5 }));
  } },
  assessmentAttempt: {
    count: async ({ where }: { where: Record<string, unknown> }) => { m.attemptWheres.push(where); return pick(where).length; },
    aggregate: async ({ where }: { where: Record<string, unknown> }) => {
      m.attemptWheres.push(where);
      const rows = pick(where);
      return { _avg: { score: rows.length ? rows.reduce((sum, a) => sum + a.score, 0) / rows.length : null } };
    },
  },
  scheduledWork: { findUnique: async () => ({ id: "work-A", classId: "class-A", class: CLASSES["class-A"], suggestedLabs: [] }), update: m.update },
  virtualLab: { findUnique: async () => m.lab },
  enrollment: { findMany: m.roster },
  labSession: { createMany: m.create },
} }));

import { GET } from "@/app/api/teacher/analytics/assessment/[contentId]/route";
import { POST } from "@/app/api/teacher/schedule/[id]/lab/route";
import { CLASS_FUNCTIONS } from "@/lib/authz/classAuthority";

const analytics = async (actor: Actor) => {
  m.actor = actor;
  const res = await GET(new Request("http://localhost/analytics"), { params: { contentId: "content-A" } });
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
};
const link = async (actor: Actor) => {
  m.actor = actor;
  const res = await POST(new NextRequest("http://localhost/lab", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ labId: "lab-A" }) }), { params: { id: "work-A" } });
  return res.status;
};
const co = (subject: string, classId = "class-B") => ({ schoolId: "school-A", teacherId: "teacher-co", classId, subject });
const CO: Actor = { id: "teacher-co", role: "TEACHER", schoolId: "school-A" };

beforeEach(() => {
  vi.clearAllMocks();
  m.assignments = [];
  m.attemptWheres = [];
  m.lab = { id: "lab-row-A", labId: "lab-A", schoolId: null, status: "published", subject: "SCIENCE", title: "Synthetic lab", labType: "SIMULATION", estimatedMinutes: 10 };
  m.roster.mockResolvedValue([{ Student: { userId: "learner-A" } }]);
  m.create.mockResolvedValue({ count: 1 });
  m.update.mockResolvedValue({ id: "work-A" });
});

describe("2a analytics: class and subject scope", () => {
  it("a SCIENCE co-teacher of class B reads only class B's attempts", async () => {
    m.assignments = [co("SCIENCE")];
    const { status, body } = await analytics(CO);
    expect(status).toBe(200);
    expect(body.totalAttempts).toBe(1);
    expect(body.avgScore).toBe(40);
    expect(JSON.stringify(body)).not.toContain("answer-A");
  });
  it("a co-teacher of another subject reads nothing (403, no attempt query)", async () => {
    m.assignments = [co("MATH")];
    expect((await analytics(CO)).status).toBe(403);
    expect(m.attemptWheres).toEqual([]);
  });
  it("attempts with no class never reach a teacher's view", async () => {
    const { body } = await analytics({ id: "teacher-A", role: "TEACHER", schoolId: "school-A" });
    expect(JSON.stringify(body)).not.toContain("answer-unclassed");
    expect(m.attemptWheres.every((where) => (where.classId as { in?: unknown })?.in !== undefined)).toBe(true);
  });
  it("a cross-school ADMIN reads nothing of the other school", async () => {
    const { body } = await analytics({ id: "admin-B", role: "ADMIN", schoolId: "school-B" });
    expect(JSON.stringify(body)).not.toMatch(/answer-(A|B|unclassed)/);
    expect(m.attemptWheres.every((where) => where.schoolId === "school-B")).toBe(true);
  });
});

describe("2b scheduled lab: class and subject scope for a write", () => {
  it("a SCIENCE co-teacher of the scheduled class may link a SCIENCE lab", async () => {
    m.assignments = [co("SCIENCE", "class-A")];
    expect(await link(CO)).toBe(200);
    expect(m.create).toHaveBeenCalledTimes(1);
  });
  it("a free-text lab subject grants a co-teacher nothing, before the roster or any write", async () => {
    m.assignments = [co("SCIENCE", "class-A")];
    m.lab = { ...m.lab, subject: "Physics" };
    expect(await link(CO)).toBe(403);
    expect(m.roster).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it("a cross-school ADMIN is refused before the roster or any write", async () => {
    expect(await link({ id: "admin-B", role: "ADMIN", schoolId: "school-B" })).toBe(403);
    expect(m.roster).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it("the class-authority service names the write class.lesson.support", () => {
    expect(CLASS_FUNCTIONS).toContain("class.lesson.support");
  });
});
