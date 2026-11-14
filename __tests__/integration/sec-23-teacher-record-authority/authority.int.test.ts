/** Real database row authority and response projection; session boundary only is replaced. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "owner" }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  const { prisma } = await import("@/lib/db"); const user = await prisma.user.findUnique({ where: { id: h.userId } });
  if (!user) throw Object.assign(Error("Unauthorized"), { status: 401 });
  if (!roles.includes(user.role)) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
} }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_23_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec23_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_23_DB_TEST === "1" && !admitted) throw Error("SEC-23 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-23 native teacher record authority", () => {
  let db: PrismaClient;
  let sms: typeof import("@/app/api/teacher/assignments/[id]/sms-status/route").GET;
  let profile: typeof import("@/app/api/student/[id]/route").GET;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ GET: sms } = await import("@/app/api/teacher/assignments/[id]/sms-status/route")); ({ GET: profile } = await import("@/app/api/student/[id]/route"));
    for (const suffix of ["A", "B"]) await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
    for (const [id, role, school] of [["owner", "TEACHER", "A"], ["other-owner", "TEACHER", "A"], ["outsider", "TEACHER", "A"], ["teacher-B", "TEACHER", "B"], ["admin-A", "ADMIN", "A"], ["admin-B", "ADMIN", "B"], ["student-user", "STUDENT", "A"]] as const)
      await db.user.create({ data: { id, email: `${id}@example.invalid`, role, schoolId: `school-${school}` } });
    await db.student.create({ data: { id: "student-profile", userId: "student-user" } });
    for (const [id, schoolId, teacherId] of [["class-A", "school-A", "owner"], ["other-class-A", "school-A", "other-owner"], ["class-B", "school-B", "teacher-B"]]) {
      await db.class.create({ data: { id, schoolId, teacherId, name: "Synthetic", subject: "MATH" } });
      await db.enrollment.create({ data: { studentId: "student-profile", classId: id } });
      await db.grade.create({ data: { studentId: "student-profile", classId: id, percent: 75, letter: "B" } });
    }
    await db.assignment.create({ data: { id: "assignment-A", title: "Synthetic", classId: "class-A" } });
    await db.smsSession.create({ data: { assignmentId: "assignment-A", studentId: "student-user", studentPhone: "+00000000000", questions: [], expiresAt: new Date(Date.now() + 600000) } });
  });
  beforeEach(async () => { h.userId = "owner"; await db.class.update({ where: { id: "class-A" }, data: { teacherId: "owner" } }); });
  afterAll(async () => { await db?.$disconnect(); });
  const smsRead = () => sms(new NextRequest("http://localhost/api/teacher/assignments/assignment-A/sms-status"), { params: { id: "assignment-A" } });
  const studentRead = () => profile(new Request("http://localhost/api/student/student-profile"), { params: { id: "student-profile" } });
  it("unassigned same-school teacher cannot read SMS student phone values", async () => {
    h.userId = "outsider"; const res = await smsRead(); expect([403, 404]).toContain(res.status); expect(JSON.stringify(await res.json())).not.toContain("+00000000000");
  });
  it("unassigned same-school teacher cannot read student email or grades", async () => {
    h.userId = "outsider"; const res = await studentRead(); expect([403, 404]).toContain(res.status); expect(JSON.stringify(await res.json())).not.toContain("student-user@example.invalid");
  });
  it("the actual class teacher retains SMS status access", async () => {
    const res = await smsRead(); expect(res.status).toBe(200); expect((await res.json()).sessions[0]).toMatchObject({ studentId: "student-user", studentPhone: "+00000000000" });
  });
  it("teacher student details contain only their authorized class enrollments and grades", async () => {
    const res = await studentRead(); expect(res.status).toBe(200); const body = await res.json();
    expect(body.user.email).toBe("student-user@example.invalid"); expect(body.enrollments.map((row: { classId: string }) => row.classId)).toEqual(["class-A"]);
    expect(body.grades.map((row: { classId: string }) => row.classId)).toEqual(["class-A"]);
  });
  it("school administrator retains own-school access but no foreign-school grade rows", async () => {
    h.userId = "admin-A"; expect((await smsRead()).status).toBe(200); const res = await studentRead(); expect(res.status).toBe(200); const body = await res.json();
    expect(body.grades.map((row: { classId: string }) => row.classId).sort()).toEqual(["class-A", "other-class-A"]);
    expect(body.enrollments.map((row: { classId: string }) => row.classId).sort()).toEqual(["class-A", "other-class-A"]);
  });
  it.each(["teacher-B", "admin-B"])("foreign-school %s cannot read either record despite a malformed foreign enrollment", async userId => {
    h.userId = userId; expect([403, 404]).toContain((await smsRead()).status); expect([403, 404]).toContain((await studentRead()).status);
  });
  it("anonymous SMS access is normalized to 401", async () => { h.userId = "missing"; expect((await smsRead()).status).toBe(401); });
  it("student role cannot access the teacher SMS route", async () => { h.userId = "student-user"; expect((await smsRead()).status).toBe(403); });
  it("reassigned class authority revokes the former teacher's reads", async () => {
    await db.class.update({ where: { id: "class-A" }, data: { teacherId: "other-owner" } });
    expect([403, 404]).toContain((await smsRead()).status); expect([403, 404]).toContain((await studentRead()).status);
  });
});
