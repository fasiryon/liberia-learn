import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "user-A" }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  const { prisma } = await import("@/lib/db"); const user = await prisma.user.findUnique({ where: { id: h.userId } });
  if (!user) throw Object.assign(Error("Unauthorized"), { status: 401 });
  if (!roles.includes(user.role)) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
} }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_22_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec22_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_22_DB_TEST === "1" && !admitted) throw Error("SEC-22 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-22 native exam list eligibility", () => {
  let db: PrismaClient; let list: typeof import("@/app/api/student/exams/route").GET;
  beforeAll(async () => {
    vi.stubEnv("ENABLE_EXAM_SYSTEM", "true"); vi.stubEnv("ENABLE_EXAM_READINESS", "false");
    vi.stubGlobal("fetch", () => { throw Error("No external calls"); });
    ({ prisma: db } = await import("@/lib/db")); ({ GET: list } = await import("@/app/api/student/exams/route"));
    for (const suffix of ["A", "B"]) {
      await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
      await db.user.create({ data: { id: `user-${suffix}`, email: `student-${suffix}@example.invalid`, role: "STUDENT", schoolId: `school-${suffix}` } });
      await db.student.create({ data: { id: `student-${suffix}`, userId: `user-${suffix}`, currentGrade: suffix === "A" ? 4 : 9 } });
      await db.class.create({ data: { id: `class-${suffix}`, schoolId: `school-${suffix}`, name: "Synthetic", subject: "MATH" } });
      await db.academicYear.create({ data: { id: `year-${suffix}`, schoolId: `school-${suffix}`, yearLabel: "2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
    }
    await db.class.create({ data: { id: "other-class-A", schoolId: "school-A", name: "Other", subject: "MATH" } });
    await db.academicYear.create({ data: { id: "other-year-A", schoolId: "school-A", yearLabel: "2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") } });
    for (const [id, classId, academicYearId] of [["global", null, null], ["own-class", "class-A", null], ["own-year", null, "year-A"], ["both", "class-A", "year-A"], ["foreign-class", "other-class-A", null], ["foreign-year", null, "other-year-A"], ["foreign-both", "other-class-A", "other-year-A"], ["inconsistent-class", "class-B", null]]) {
      await db.exam.create({ data: { id: id!, title: id!, subject: "MATH", grade: 4, schoolId: "school-A", classId, academicYearId,
        createdBy: "synthetic", status: "PUBLISHED", timeLimit: 30, moeStandards: [], questions: { create: { prompt: `question-${id}`, options: ["A", "B"], correctIndex: 0, explanation: "withheld-key", moeCode: "synthetic" } } } });
    }
    await db.exam.create({ data: { id: "school-B-grade9", title: "Grade9", subject: "MATH", grade: 9, schoolId: "school-B", classId: "class-B", academicYearId: "year-B", createdBy: "synthetic", status: "PUBLISHED", timeLimit: 30, moeStandards: [] } });
    await db.user.create({ data: { id: "unprofiled", email: "unprofiled@example.invalid", role: "STUDENT", schoolId: "school-A" } });
  });
  beforeEach(async () => {
    h.userId = "user-A"; vi.stubEnv("ENABLE_EXAM_SYSTEM", "true");
    for (const suffix of ["A", "B"]) {
      await db.enrollment.upsert({ where: { studentId_classId: { studentId: `student-${suffix}`, classId: `class-${suffix}` } }, create: { studentId: `student-${suffix}`, classId: `class-${suffix}` }, update: {} });
      await db.academicEnrollment.upsert({ where: { studentId_schoolId_academicYearId: { studentId: `student-${suffix}`, schoolId: `school-${suffix}`, academicYearId: `year-${suffix}` } },
        create: { studentId: `student-${suffix}`, schoolId: `school-${suffix}`, academicYearId: `year-${suffix}`, grade: suffix === "A" ? 4 : 9 }, update: {} });
    }
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  const ids = async () => (await (await list()).json()).exams.map((exam: { id: string }) => exam.id).sort();
  it("lists only the Grade4 learner's authorized class/year and school-wide exams", async () => { expect(await ids()).toEqual(["both", "global", "own-class", "own-year"]); });
  it("does not return foreign class/year question bodies", async () => {
    const body = JSON.stringify(await (await list()).json()); expect(body).not.toContain("question-foreign"); expect(body).not.toContain("question-inconsistent");
  });
  it("continues to withhold answer keys and explanations on authorized questions", async () => {
    const body = JSON.stringify(await (await list()).json()); expect(body).not.toContain("correctIndex"); expect(body).not.toContain("withheld-key"); expect(body).not.toContain('"explanation"');
  });
  it("removing roster membership immediately removes class-bound exams", async () => {
    await db.enrollment.deleteMany({ where: { studentId: "student-A" } }); expect(await ids()).toEqual(["global", "own-year"]);
  });
  it("removing year enrollment immediately removes year-bound exams", async () => {
    await db.academicEnrollment.deleteMany({ where: { studentId: "student-A" } }); expect(await ids()).toEqual(["global", "own-class"]);
  });
  it("Grade9 in another school receives only its own eligible exam", async () => { h.userId = "user-B"; expect(await ids()).toEqual(["school-B-grade9"]); });
  it("missing student profile refuses all exam bodies", async () => { h.userId = "unprofiled"; expect(await ids()).toEqual([]); });
  it("disabled exam system retains its existing empty-list contract", async () => { vi.stubEnv("ENABLE_EXAM_SYSTEM", "false"); expect(await (await list()).json()).toEqual({ exams: [], disabled: true }); });
});
