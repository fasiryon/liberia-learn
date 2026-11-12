/** Real PostgreSQL, db_setup=push, LL_SEC_03_DB_TEST=1, disposable loopback
 * DATABASE_URL with connection_limit=1. Session/push and one required-audit
 * fault are substituted; class authority, writes, CAS and transactions are real.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "", role: "TEACHER", schoolId: "", isPlatformAdmin: false },
  failAudit: false, push: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => h.actor }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: h.push }));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit")>("@/lib/audit");
  return { ...actual, logAuditRequired: async (...args: Parameters<typeof actual.logAuditRequired>) => {
    if (h.failAudit) throw new Error("synthetic audit failure"); return actual.logAuditRequired(...args);
  } };
});
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_03_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /(?:e2e|test|sec.?03)/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* Not an admitted disposable target. */ }
if (process.env.LL_SEC_03_DB_TEST === "1" && !admitted) throw new Error("SEC-03 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-03 capstone native authority and atomicity", () => {
  let db: PrismaClient;
  let patch: typeof import("@/app/api/teacher/capstone/[id]/review/route").PATCH;
  const prefix = `sec03-${Date.now().toString(36)}`;
  const a = `${prefix}-A`, b = `${prefix}-B`, teacher = `${prefix}-teacher`, other = `${prefix}-other`, foreign = `${prefix}-foreign`;
  const coTeacher = `${prefix}-co`, studentUser = `${prefix}-learner`, student = `${prefix}-student`, cls = `${prefix}-class`;
  let sequence = 0;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ PATCH: patch } = await import("@/app/api/teacher/capstone/[id]/review/route"));
    await db.school.createMany({ data: [{ id: a, name: "Synthetic A" }, { id: b, name: "Synthetic B" }] });
    for (const [id, schoolId] of [[teacher, a], [coTeacher, a], [other, a], [foreign, b]]) {
      await db.user.create({ data: { id, email: `${id}@synthetic.invalid`, role: "TEACHER", schoolId } });
    }
    await db.user.create({ data: { id: studentUser, email: `${studentUser}@synthetic.invalid`, role: "STUDENT", schoolId: a } });
    await db.student.create({ data: { id: student, userId: studentUser } });
    await db.class.create({ data: { id: cls, name: "Synthetic class", schoolId: a, subject: "MATH", teacherId: teacher } });
    await db.teacherAssignment.create({ data: { schoolId: a, teacherId: coTeacher, classId: cls, subject: "MATH" } });
    await db.enrollment.create({ data: { studentId: student, classId: cls } });
    h.push.mockResolvedValue(undefined);
  });
  async function fixture() {
    h.failAudit = false; h.push.mockClear(); h.actor = { id: teacher, role: "TEACHER", schoolId: a, isPlatformAdmin: false };
    return db.capstoneProject.create({ data: { id: `${prefix}-${++sequence}`, studentId: student, title: "Synthetic capstone", status: "SUBMITTED" } });
  }
  const review = (id: string, decision = "APPROVED") => patch(new NextRequest("http://localhost/api/teacher/capstone/review", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, feedback: "Synthetic feedback" }),
  }), { params: { id } });
  async function noEffects(id: string) {
    expect((await db.capstoneProject.findUniqueOrThrow({ where: { id } })).status).toBe("SUBMITTED");
    expect(await db.portfolioItem.count({ where: { capstoneProjectId: id } })).toBe(0);
    expect(await db.auditLog.count({ where: { resourceId: id, action: "teacher.capstone.reviewed" } })).toBe(0);
    expect(h.push).not.toHaveBeenCalled();
  }
  it("foreign teachers are refused", async () => {
    const p = await fixture(); h.actor = { id: foreign, role: "TEACHER", schoolId: b, isPlatformAdmin: false };
    expect((await review(p.id)).status).toBe(404); await noEffects(p.id);
  });
  it("unassigned same-school teachers are refused", async () => {
    const p = await fixture(); h.actor.id = other; expect((await review(p.id)).status).toBe(404); await noEffects(p.id);
  });
  it("a stale teacher session cannot use a changed role", async () => {
    const p = await fixture(); await db.user.update({ where: { id: teacher }, data: { role: "GUARDIAN" } });
    try { expect((await review(p.id)).status).toBe(403); await noEffects(p.id); }
    finally { await db.user.update({ where: { id: teacher }, data: { role: "TEACHER" } }); }
  });
  it("an unenrolled learner grants no review authority", async () => {
    const p = await fixture(); await db.enrollment.delete({ where: { studentId_classId: { studentId: student, classId: cls } } });
    try { expect((await review(p.id)).status).toBe(404); await noEffects(p.id); }
    finally { await db.enrollment.create({ data: { studentId: student, classId: cls } }); }
  });
  it("audit failure rolls back review and portfolio together", async () => {
    const p = await fixture(); h.failAudit = true;
    try { expect((await review(p.id)).status).toBe(500); await noEffects(p.id); }
    finally { h.failAudit = false; }
  });
  it("primary teacher approval creates one portfolio item and one required audit", async () => {
    const p = await fixture(); expect((await review(p.id)).status).toBe(200);
    expect(await db.portfolioItem.count({ where: { capstoneProjectId: p.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { resourceId: p.id, action: "teacher.capstone.reviewed", schoolId: a } })).toBe(1);
  });
  it("subject-assigned co-teacher can reject without creating a portfolio item", async () => {
    const p = await fixture(); h.actor.id = coTeacher; expect((await review(p.id, "REJECTED")).status).toBe(200);
    expect(await db.portfolioItem.count({ where: { capstoneProjectId: p.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { resourceId: p.id, action: "teacher.capstone.reviewed" } })).toBe(1);
  });
  it("concurrent reviews persist one decision, one portfolio item and one audit", async () => {
    const p = await fixture(); const responses = await Promise.all([review(p.id), review(p.id)]);
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 400 || r.status === 409)).toHaveLength(1);
    expect(await db.portfolioItem.count({ where: { capstoneProjectId: p.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { resourceId: p.id, action: "teacher.capstone.reviewed" } })).toBe(1);
  });
});
