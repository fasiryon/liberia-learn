/** CoS: db_setup=push, LL_SEC_04_DB_TEST=1, disposable loopback PostgreSQL,
 * connection_limit=1. Only session lookup is substituted; tenant resolution,
 * enrollment queries and persisted submissions use their actual implementations.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "", role: "STUDENT", schoolId: "" } }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => h.actor, requireRole: async (role: string) => {
  if (h.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return h.actor;
} }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_04_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /(?:e2e|test|sec.?04)/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* No disposable PostgreSQL target. */ }
if (process.env.LL_SEC_04_DB_TEST === "1" && !admitted) throw new Error("SEC-04 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-04 native homework authority", () => {
  let db: PrismaClient;
  let post: typeof import("@/app/api/student/homework/submit/route").POST;
  const prefix = `sec04-${Date.now().toString(36)}`, a = `${prefix}-A`, b = `${prefix}-B`;
  const learner = `${prefix}-learner`, teacher = `${prefix}-teacher`, student = `${prefix}-student`;
  const cls = `${prefix}-class`, other = `${prefix}-other-class`, foreign = `${prefix}-foreign-class`;
  const ownHw = `${prefix}-own`, otherHw = `${prefix}-other`, foreignHw = `${prefix}-foreign`;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ POST: post } = await import("@/app/api/student/homework/submit/route"));
    await db.school.createMany({ data: [{ id: a, name: "Synthetic A" }, { id: b, name: "Synthetic B" }] });
    await db.user.createMany({ data: [{ id: learner, email: `${learner}@synthetic.invalid`, role: "STUDENT", schoolId: a },
      { id: teacher, email: `${teacher}@synthetic.invalid`, role: "TEACHER", schoolId: a }] });
    await db.student.create({ data: { id: student, userId: learner } });
    await db.class.createMany({ data: [[cls, a], [other, a], [foreign, b]].map(([id, schoolId]) => ({ id, schoolId, name: "Synthetic", subject: "MATH" })) });
    await db.enrollment.create({ data: { studentId: student, classId: cls } });
    await db.homework.createMany({ data: [[ownHw, cls], [otherHw, other], [foreignHw, foreign]].map(([id, classId]) => ({ id, classId, createdById: teacher, title: "Synthetic homework" })) });
    h.actor = { id: learner, role: "STUDENT", schoolId: a };
  });
  const submit = (homeworkId: string, redirect = "/assignments") => {
    const body = new FormData(); body.set("homeworkId", homeworkId); body.set("redirectTo", redirect); body.set("answer_0", "Synthetic answer");
    return post(new Request("http://localhost/api/student/homework/submit", { method: "POST", body }));
  };
  it.each([otherHw, foreignHw])("denies unavailable homework %s", async id => {
    expect((await submit(id)).status).toBe(404);
    expect(await db.homeworkSubmission.count({ where: { homeworkId: id, studentId: student } })).toBe(0);
  });
  it.each(["https://outside.invalid/", "//outside.invalid/", "/\\outside.invalid/"])("denies non-local redirect %s before writing", async redirect => {
    expect((await submit(ownHw, redirect)).status).toBe(400);
    expect(await db.homeworkSubmission.count({ where: { homeworkId: ownHw, studentId: student } })).toBe(0);
  });
  it("accepts an enrolled student's local submission", async () => {
    const response = await submit(ownHw, "/assignments?tab=mine"); expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/assignments?tab=mine");
    expect((await db.homeworkSubmission.findUniqueOrThrow({ where: { homeworkId_studentId: { homeworkId: ownHw, studentId: student } } })).answers).toEqual(["Synthetic answer"]);
  });
});
