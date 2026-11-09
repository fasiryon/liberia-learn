/**
 * AT-GRADE-01-LSID (CoS cycle 03, COS-CYCLE-03-RESULTS-20261028.md): GET and PATCH /api/teacher/labs/sessions/[sessionId]
 * authorize through lib/authz/classAuthority for the class of the session's scheduled work, not Class.teacherId or "any
 * same-school ADMIN":
 * - GET (read the learner's lab session) needs class.read.learning; PATCH writes a teacher score (0-100), an assessment
 *   judgement, so it needs class.assessment.review (CoS ruling 2026-10-28; class.feedback is for comments without a
 *   score). The audit basis therefore names assessment review;
 * - the class teacher and an ADMIN of the class's school have whole-class authority;
 * - a subject co-teacher of that class may read and review only when VirtualLab.subject is EXACTLY their assigned
 *   Subject (founder decision 3: free-text lab subjects grant co-teachers nothing);
 * - another class's co-teacher, another subject, and a same-school teacher with no basis are refused (403) before any
 *   lab read or write;
 * - a session with no scheduled work, of another school, or unknown stays the non-disclosing 404.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Actor = { id: string; role: string; schoolId: string | null };
const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null },
  session: null as null | Record<string, unknown>,
  work: null as null | Record<string, unknown>,
  lab: { labId: "lab-A", title: "Circuit lab", payload: {}, subject: "SCIENCE" } as Record<string, unknown>,
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  labReads: 0, update: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit, logAuditRequired: m.audit }));
vi.mock("@/lib/serverFlags", () => ({ isVirtualLabsEnabled: () => true }));
// The real service, wrapped only so the class function each method asks for can be asserted.
vi.mock("@/lib/authz/classAuthority", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authz/classAuthority")>();
  return { ...actual, authorizeClassAccess: vi.fn(actual.authorizeClassAccess) };
});
vi.mock("@/lib/db", () => ({ prisma: {
  labSession: { findUnique: async () => m.session, update: m.update },
  scheduledWork: { findUnique: async () => m.work },
  class: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === "class-A" ? { schoolId: "school-A", teacherId: "teacher-A" } : where.id === "class-B" ? { schoolId: "school-A", teacherId: "teacher-B" } : null) },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.assignments.filter((row) => Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v)) },
  virtualLab: { findUnique: async () => { m.labReads += 1; return m.lab; } },
} }));

import { GET, PATCH } from "@/app/api/teacher/labs/sessions/[sessionId]/route";
import { authorizeClassAccess } from "@/lib/authz/classAuthority";

const SESSION = { id: "sess-A", labId: "lab-A", studentId: "learner-A", schoolId: "school-A", scheduledWorkId: "work-A", student: { id: "learner-A", name: "L", email: null } };
const WORK = { id: "work-A", classId: "class-A", class: { teacherId: "teacher-A", schoolId: "school-A", name: "P4 Blue" } };
const TEACHER = (id: string, schoolId: string | null = "school-A"): Actor => ({ id, role: "TEACHER", schoolId });
const co = (subject: string, classId = "class-A") => ({ schoolId: "school-A", teacherId: "teacher-co", classId, subject });
const read = async (actor: Actor) => { m.actor = actor; return (await GET({} as never, { params: { sessionId: "sess-A" } })).status; };
const review = async (actor: Actor) => {
  m.actor = actor;
  const req = { json: async () => ({ score: 80, teacherFeedback: "Clear evidence for both designs." }) };
  return (await PATCH(req as never, { params: { sessionId: "sess-A" } })).status;
};
const noWrite = () => { expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled(); };

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { ...SESSION }; m.work = { ...WORK }; m.assignments = []; m.labReads = 0;
  m.lab = { labId: "lab-A", title: "Circuit lab", payload: {}, subject: "SCIENCE" };
  m.update.mockResolvedValue({ id: "sess-A", score: 80 });
});

describe("the class function each method asks for", () => {
  const fns = () => vi.mocked(authorizeClassAccess).mock.calls.map(([, request]) => request.fn);
  it("GET asks for class.read.learning only", async () => {
    m.assignments = [co("SCIENCE")];
    expect(await read(TEACHER("teacher-co"))).toBe(200);
    expect(new Set(fns())).toEqual(new Set(["class.read.learning"]));
  });
  it("PATCH (a teacher score) asks for class.assessment.review only, never class.feedback", async () => {
    m.assignments = [co("SCIENCE")];
    expect(await review(TEACHER("teacher-co"))).toBe(200);
    expect(new Set(fns())).toEqual(new Set(["class.assessment.review"]));
  });
});

describe("whole-class authority", () => {
  it.each<[string, Actor]>([["the class teacher", TEACHER("teacher-A")], ["an ADMIN of the class's school", { id: "admin-A", role: "ADMIN", schoolId: "school-A" }]])("%s reads and reviews", async (_, actor) => {
    expect(await read(actor)).toBe(200);
    expect(await review(actor)).toBe(200);
    expect(m.update).toHaveBeenCalledTimes(1);
  });
});

describe("subject co-teacher of the session's class", () => {
  it("reads and reviews a lab whose subject is exactly the assigned Subject", async () => {
    m.assignments = [co("SCIENCE")];
    expect(await read(TEACHER("teacher-co"))).toBe(200);
    expect(await review(TEACHER("teacher-co"))).toBe(200);
  });
  it.each([["a free-text lab subject", "Physics"], ["a differently written subject", "science"]])("is refused for %s (no inferred mapping)", async (_, subject) => {
    m.assignments = [co("SCIENCE")]; m.lab = { ...m.lab, subject };
    expect(await read(TEACHER("teacher-co"))).toBe(403);
    expect(await review(TEACHER("teacher-co"))).toBe(403);
    noWrite();
  });
  it("is refused when assigned another subject", async () => {
    m.assignments = [co("MATH")];
    expect(await review(TEACHER("teacher-co"))).toBe(403);
    noWrite();
  });
});

describe("refused before any lab read or write", () => {
  it.each<[string, () => void, Actor]>([
    ["a same-school teacher with no class basis", () => {}, TEACHER("teacher-other")],
    ["a co-teacher of another class", () => { m.assignments = [co("SCIENCE", "class-B")]; }, TEACHER("teacher-co")],
    ["the teacher of another class", () => {}, TEACHER("teacher-B")],
  ])("%s gets 403", async (_, arrange, actor) => {
    arrange();
    expect(await read(actor)).toBe(403);
    expect(await review(actor)).toBe(403);
    expect(m.labReads).toBe(0);
    noWrite();
  });
});

describe("non-disclosing 404 kept", () => {
  it.each<[string, () => void]>([
    ["a session with no scheduled work", () => { m.session = { ...SESSION, scheduledWorkId: null }; }],
    ["a session of another school", () => { m.session = { ...SESSION, schoolId: "school-B" }; }],
    ["an unknown session", () => { m.session = null; }],
    ["scheduled work of another school's class", () => { m.work = { ...WORK, class: { ...WORK.class, schoolId: "school-B" } }; }],
  ])("%s", async (_, arrange) => {
    arrange();
    expect(await read(TEACHER("teacher-A"))).toBe(404);
    expect(await review(TEACHER("teacher-A"))).toBe(404);
    noWrite();
  });
});
