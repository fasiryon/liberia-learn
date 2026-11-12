import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  actor: { id: "teacher-1", role: "TEACHER", schoolId: "school-A", isPlatformAdmin: false },
  school: "school-A", status: "SUBMITTED", portfolio: [] as string[], allowed: true,
  failPortfolio: false, audit: vi.fn(), push: vi.fn(), authority: vi.fn(), tx: {} as Record<string, unknown>,
}));
const project = () => ({ id: "project-1", studentId: "student-1", title: "Synthetic project", status: m.status,
  Student: { id: "student-1", userId: "student-user", deletedAt: null, user: { schoolId: m.school },
    enrollments: [{ classId: "class-1", Class: { id: "class-1", subject: "MATH", schoolId: m.school } }] } });
vi.mock("@/lib/auth", () => ({ requireUser: async () => m.actor }));
vi.mock("@/lib/authz/classAuthority", () => ({ authorizeClassAccessWithClient: m.authority, isClassAccessAllowed: (d: { allowed: boolean }) => d.allowed }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: m.audit }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: m.push }));
vi.mock("@/lib/db", () => {
  const capstoneProject = {
    findUnique: async () => project(), findUniqueOrThrow: async () => project(),
    update: async ({ data }: { data: { status: string } }) => { m.status = data.status; return project(); },
    updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
      if (m.status !== where.status) return { count: 0 }; m.status = data.status; return { count: 1 };
    },
  };
  const portfolioItem = { create: async () => {
    if (m.failPortfolio) throw new Error("synthetic portfolio failure"); m.portfolio.push("project-1"); return {};
  } };
  const student = { findUnique: async () => ({ userId: "student-user" }) };
  return { prisma: { capstoneProject, portfolioItem, student,
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const before = { status: m.status, portfolio: [...m.portfolio] };
      m.tx = { capstoneProject, portfolioItem, student, $queryRaw: async () => [m.actor] };
      try { return await work(m.tx); } catch (error) { m.status = before.status; m.portfolio = before.portfolio; throw error; }
    },
  } };
});
import { PATCH } from "@/app/api/teacher/capstone/[id]/review/route";
const review = (decision = "APPROVED") => PATCH(new NextRequest("http://localhost/api/teacher/capstone/project-1/review", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, feedback: "Synthetic feedback" }),
}), { params: { id: "project-1" } }).catch(() => new Response("uncaught route exception", { status: 500 }));
beforeEach(() => {
  vi.clearAllMocks(); m.actor = { id: "teacher-1", role: "TEACHER", schoolId: "school-A", isPlatformAdmin: false };
  m.school = "school-A"; m.status = "SUBMITTED"; m.portfolio = []; m.allowed = true; m.failPortfolio = false;
  m.push.mockResolvedValue(undefined); m.audit.mockResolvedValue(undefined);
  m.authority.mockImplementation(async () => ({ allowed: m.allowed, basis: "CLASS_TEACHER" }));
});
async function denied(status: number) {
  expect((await review()).status).toBe(status); expect(m.status).toBe("SUBMITTED");
  expect(m.portfolio).toEqual([]); expect(m.audit).not.toHaveBeenCalled(); expect(m.push).not.toHaveBeenCalled();
}
describe("SEC-03 capstone review authority and atomicity", () => {
  it("denies a cross-school teacher", async () => { m.school = "school-B"; await denied(404); });
  it("denies a same-school teacher without class authority", async () => { m.allowed = false; await denied(404); });
  it("denies a school-less teacher", async () => { m.actor.schoolId = ""; await denied(403); });
  it.each(["STUDENT", "GUARDIAN", "ADMIN"])("preserves %s denial", async role => { m.actor.role = role; await denied(403); });
  it("denies platform-admin bypass", async () => { m.actor.role = "ADMIN"; m.actor.isPlatformAdmin = true; await denied(403); });
  it("rolls back approval if portfolio creation fails", async () => {
    m.failPortfolio = true; expect((await review()).status).toBe(500);
    expect(m.status).toBe("SUBMITTED"); expect(m.portfolio).toEqual([]); expect(m.push).not.toHaveBeenCalled();
  });
  it("rolls back approval and portfolio if required audit fails", async () => {
    m.audit.mockRejectedValue(new Error("synthetic audit failure")); expect((await review()).status).toBe(500);
    expect(m.status).toBe("SUBMITTED"); expect(m.portfolio).toEqual([]); expect(m.push).not.toHaveBeenCalled();
  });
  it("an authorized teacher approves once with transaction-bound authority and audit", async () => {
    expect((await review()).status).toBe(200); expect(m.status).toBe("APPROVED"); expect(m.portfolio).toEqual(["project-1"]);
    expect(m.authority).toHaveBeenCalledWith(m.tx, m.actor, expect.objectContaining({ classId: "class-1", subject: "MATH", fn: "class.assessment.review" }));
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "teacher.capstone.reviewed", schoolId: "school-A" }), m.tx);
    expect(m.push).toHaveBeenCalledTimes(1);
  });
  it("authorized rejection records audit but no portfolio item", async () => {
    expect((await review("REJECTED")).status).toBe(200); expect(m.status).toBe("REJECTED");
    expect(m.portfolio).toEqual([]); expect(m.audit).toHaveBeenCalledTimes(1);
  });
});
