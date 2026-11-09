/**
 * AT-GRADE-01-2D (CoS rulings 2026-10-28).
 * EXAMS (E-A): GET /api/teacher/exams lists a class-bound exam only when lib/authz/classAuthority grants
 * class.read.learning for the exam's class with the exam's subject (class teacher, or a co-teacher of that subject);
 * the attempt aggregates are that class's exam's. Unclassed exams (classId null) are ADMIN-only (through the admin
 * exams route) and never appear here. No attempt data is read for an exam the teacher may not see.
 * PLACEMENTS (founder decision pending; nothing is narrowed or widened for teachers): the hardenings valid under any
 * option: (a) no isPlatformAdmin bypass of the school scope in loadScopedPlacement; (b) a learner with no school is
 * refused; (c) PLACEMENT_CONFIRM, the official grade, stays ADMIN-only even for a platform-flagged non-ADMIN account.
 * Synthetic identities and mocks only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  actor: null as unknown as { id: string; role: string; schoolId: string | null; isPlatformAdmin?: boolean },
  assignments: [] as { schoolId: string; teacherId: string; classId: string; subject: string }[],
  attemptsReadFor: [] as string[],
  placement: null as null | Record<string, unknown>,
  review: vi.fn(), decision: vi.fn(), audit: vi.fn(),
}));
const EXAMS = [
  { id: "exam-A", schoolId: "school-A", classId: "class-A", subject: "MATH", deletedAt: null, title: "A", grade: 4, status: "PUBLISHED", createdAt: new Date(3) },
  { id: "exam-B", schoolId: "school-A", classId: "class-B", subject: "MATH", deletedAt: null, title: "B", grade: 4, status: "PUBLISHED", createdAt: new Date(2) },
  { id: "exam-unclassed", schoolId: "school-A", classId: null, subject: "MATH", deletedAt: null, title: "U", grade: 4, status: "PUBLISHED", createdAt: new Date(1) },
  { id: "exam-other-school", schoolId: "school-B", classId: "class-C", subject: "MATH", deletedAt: null, title: "C", grade: 4, status: "PUBLISHED", createdAt: new Date(0) },
];
const CLASSES: Record<string, { schoolId: string; teacherId: string }> = {
  "class-A": { schoolId: "school-A", teacherId: "teacher-A" }, "class-B": { schoolId: "school-A", teacherId: "teacher-B" }, "class-C": { schoolId: "school-B", teacherId: "teacher-C" },
};
/** Honors the predicates a route actually sends; an unsupported predicate fails loudly. */
function matches(exam: Record<string, unknown>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (!(key in exam)) throw new Error(`unsupported exam predicate: ${key}`);
    if (value && typeof value === "object" && "in" in value) return value.in.includes(exam[key]);
    if (value && typeof value === "object" && "not" in value) return exam[key] !== value.not;
    return exam[key] === value;
  });
}

vi.mock("@/lib/auth", () => ({
  requireUser: async () => m.actor,
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return m.actor;
  },
}));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: () => true }));
vi.mock("@/lib/outcomes/examReadiness", () => ({ buildTeacherExamReadinessSummary: async () => null }));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit, logAuditRequired: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: {
  exam: { findMany: async ({ where, select }: { where: Record<string, unknown>; select: Record<string, unknown> }) => {
    const rows = EXAMS.filter((e) => matches(e, where));
    if (select?.attempts) m.attemptsReadFor.push(...rows.map((r) => r.id));
    return rows.map((e) => ({ ...e, class: e.classId ? { name: e.classId } : null, academicYear: null, resultsPublishedAt: null,
      attempts: select?.attempts ? [{ score: 0.8, passed: true, submittedAt: new Date(0), integrityFlags: [] }] : undefined, _count: { attempts: 1 } }));
  } },
  class: { findUnique: async ({ where }: { where: { id: string } }) => CLASSES[where.id] ?? null },
  teacherAssignment: { findMany: async ({ where }: { where: Record<string, unknown> }) => m.assignments.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) },
  placementTest: { findUnique: async () => m.placement },
  placementReview: { create: m.review },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ placementDecision: { create: m.decision }, placementTest: { update: vi.fn() }, student: { update: vi.fn() } }),
} }));

import { GET as listExams } from "@/app/api/teacher/exams/route";
import { confirmOfficialPlacement, recordPlacementReview } from "@/lib/placementAuthority/decisionService";

const examIds = async (actor: typeof m.actor) => {
  m.actor = actor;
  const res = await listExams();
  return { status: res.status, ids: res.status === 200 ? ((await res.json()).exams as { id: string }[]).map((e) => e.id) : [] };
};
const T = (id: string, schoolId: string | null = "school-A", extra: Record<string, unknown> = {}) => ({ id, role: "TEACHER", schoolId, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  m.assignments = []; m.attemptsReadFor = [];
  m.placement = { id: "pl-A", studentId: "stu-A", estimatedGrade: 4, source: "server_session", decision: null,
    student: { id: "stu-A", currentGrade: 3, guardians: [], user: { id: "u-A", name: "L", schoolId: "school-A", guardianPhoneE164: null, school: { name: "S" } } } };
  m.review.mockResolvedValue({ id: "rev-1", createdAt: new Date(0), recommendation: "endorse", recommendedGrade: null, note: null });
  m.decision.mockResolvedValue({ id: "dec-1", finalGrade: 4, createdAt: new Date(0) });
});

describe("exams (E-A)", () => {
  it("the class teacher sees only their class's exam, and attempts are read only for it", async () => {
    expect(await examIds(T("teacher-A"))).toEqual({ status: 200, ids: ["exam-A"] });
    expect(m.attemptsReadFor).toEqual(["exam-A"]);
  });
  it("a co-teacher of the exam's class and subject sees it; another subject does not", async () => {
    m.assignments = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-B", subject: "MATH" }];
    expect((await examIds(T("teacher-co"))).ids).toEqual(["exam-B"]);
    m.assignments = [{ schoolId: "school-A", teacherId: "teacher-co", classId: "class-B", subject: "SCIENCE" }];
    m.attemptsReadFor = [];
    expect((await examIds(T("teacher-co"))).ids).toEqual([]);
    expect(m.attemptsReadFor).toEqual([]);
  });
  it("an unclassed exam never appears for a teacher (ADMIN-only)", async () => {
    expect((await examIds(T("teacher-A"))).ids).not.toContain("exam-unclassed");
    expect(m.attemptsReadFor).not.toContain("exam-unclassed");
  });
  it("a same-school teacher with no class basis sees nothing and no attempts are read", async () => {
    expect(await examIds(T("teacher-other"))).toEqual({ status: 200, ids: [] });
    expect(m.attemptsReadFor).toEqual([]);
  });
  it("another school's exam never appears", async () => {
    expect((await examIds(T("teacher-C"))).ids).not.toContain("exam-other-school");
  });
  it("non-teachers are refused (403) before any read", async () => {
    expect((await examIds({ id: "admin-A", role: "ADMIN", schoolId: "school-A" })).status).toBe(403);
    expect(m.attemptsReadFor).toEqual([]);
  });
});

describe("placement hardenings (valid under any founder option)", () => {
  it("(a) a platform admin of another school cannot review or confirm (no school-scope bypass)", async () => {
    await expect(recordPlacementReview({ id: "pa", role: "ADMIN", schoolId: "school-B", isPlatformAdmin: true }, "pl-A", { recommendation: "endorse" })).rejects.toMatchObject({ status: 404 });
    await expect(confirmOfficialPlacement({ id: "pa", role: "ADMIN", schoolId: "school-B", isPlatformAdmin: true }, "pl-A", { finalGrade: 4 })).rejects.toMatchObject({ status: 404 });
    expect(m.review).not.toHaveBeenCalled(); expect(m.decision).not.toHaveBeenCalled();
  });
  it("(a) a platform admin with no school cannot review", async () => {
    await expect(recordPlacementReview({ id: "pa", role: "ADMIN", schoolId: null, isPlatformAdmin: true }, "pl-A", { recommendation: "endorse" })).rejects.toMatchObject({ status: 404 });
    expect(m.review).not.toHaveBeenCalled();
  });
  it("(b) a learner with no school is refused", async () => {
    m.placement = { ...m.placement!, student: { ...(m.placement!.student as object), user: { id: "u-A", name: "L", schoolId: null, guardianPhoneE164: null, school: null } } };
    await expect(recordPlacementReview(T("teacher-A"), "pl-A", { recommendation: "endorse" })).rejects.toMatchObject({ status: 404 });
    expect(m.review).not.toHaveBeenCalled();
  });
  it("(c) a platform-flagged TEACHER of the same school cannot confirm the official grade", async () => {
    await expect(confirmOfficialPlacement(T("teacher-A", "school-A", { isPlatformAdmin: true }), "pl-A", { finalGrade: 4 })).rejects.toMatchObject({ status: 403 });
    expect(m.decision).not.toHaveBeenCalled();
  });
  it("unchanged: a same-school TEACHER may still record a review (no narrowing before the founder rules)", async () => {
    await expect(recordPlacementReview(T("teacher-other"), "pl-A", { recommendation: "endorse" })).resolves.toBeTruthy();
    expect(m.review).toHaveBeenCalledTimes(1);
  });
  it("unchanged: a same-school ADMIN may confirm", async () => {
    await expect(confirmOfficialPlacement({ id: "admin-A", role: "ADMIN", schoolId: "school-A" }, "pl-A", { finalGrade: 4 })).resolves.toBeTruthy();
    expect(m.decision).toHaveBeenCalledTimes(1);
  });
});
