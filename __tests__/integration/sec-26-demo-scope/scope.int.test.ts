/** Reconcile the audit claim against the guarded bound base using actual SQL.
 * This suite intentionally does not invent a RED result when existing guards work.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "platform" }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: async () => {
  const { prisma } = await import("@/lib/db"); const user = await prisma.user.findUniqueOrThrow({ where: { id: h.userId } });
  if (!user.isPlatformAdmin) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
} }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_26_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec26_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_26_DB_TEST === "1" && !admitted) throw Error("SEC-26 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-26 native existing demo guards", () => {
  let db: PrismaClient;
  let advance: typeof import("@/app/api/platform/demo/advance-day/route").POST;
  let simulate: typeof import("@/app/api/platform/demo/simulate-activity/route").POST;
  let primary: string; let secondary: string;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z");
  beforeAll(async () => {
    vi.stubEnv("DEMO_SCHOOL_IDS", undefined);
    const { resolveDemoSchoolScope } = await import("@/lib/demo/reset");
    const seeded = resolveDemoSchoolScope().schoolIds;
    primary = seeded[0]; secondary = seeded.find(id => id !== primary)!;
    expect(primary).toBeTruthy(); expect(secondary).toBeTruthy();
    ({ prisma: db } = await import("@/lib/db"));
    ({ POST: advance } = await import("@/app/api/platform/demo/advance-day/route"));
    ({ POST: simulate } = await import("@/app/api/platform/demo/simulate-activity/route"));
    await db.curriculumContent.create({ data: { contentId: "sec26-content", grade: 4, subject: "MATH", contentType: "lesson", status: "published", version: "synthetic-1", payload: {} } });
    for (const [index, schoolId] of [primary, secondary, "school-real-test", "school_mca"].entries()) {
      await db.school.create({ data: { id: schoolId, name: `Synthetic fixture ${index}` } });
      await db.user.create({ data: { id: `sec26-user-${index}`, email: `sec26-${index}@example.invalid`, schoolId, role: "STUDENT" } });
      await db.student.create({ data: { id: `sec26-student-${index}`, userId: `sec26-user-${index}` } });
      await db.class.create({ data: { id: `sec26-class-${index}`, name: "Synthetic", subject: "MATH", schoolId } });
      await db.enrollment.create({ data: { classId: `sec26-class-${index}`, studentId: `sec26-student-${index}` } });
      await db.scheduledWork.create({ data: { id: `sec26-work-${index}`, classId: `sec26-class-${index}`, contentId: "sec26-content", createdById: "platform", scheduledDate: today } });
    }
    for (const [id, platform] of [["platform", true], ["ordinary", false]] as const) await db.user.create({ data: { id, email: `${id}@example.invalid`, role: "ADMIN", schoolId: "school-real-test", isPlatformAdmin: platform } });
  });
  beforeEach(async () => {
    h.userId = "platform"; vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("VERCEL_ENV", ""); vi.stubEnv("ENABLE_MOE_PORTAL", "true");
    vi.stubEnv("MOE_PORTAL_ALLOWLIST", "platform@example.invalid"); vi.stubEnv("DEMO_SCHOOL_IDS", primary); vi.stubEnv("ALLOW_LIVE_DEMO_RESET", "true");
    await db.scheduledWork.updateMany({ data: { scheduledDate: today } }); await db.studentProgress.deleteMany();
  });
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); });
  const date = async (index: number) => (await db.scheduledWork.findUniqueOrThrow({ where: { id: `sec26-work-${index}` } })).scheduledDate;
  const unchanged = async () => { for (const index of [0, 1, 2, 3]) expect(await date(index)).toEqual(today); expect(await db.studentProgress.count()).toBe(0); };
  it("without configured IDs only reserved seeded demo schools move; an ordinary school never moves", async () => {
    vi.stubEnv("DEMO_SCHOOL_IDS", undefined); expect((await advance()).status).toBe(200);
    expect((await date(0)).getTime()).toBe(today.getTime() + 86400000); expect((await date(1)).getTime()).toBe(today.getTime() + 86400000); expect(await date(2)).toEqual(today); expect(await date(3)).toEqual(today);
  });
  it("configured allowlist narrows the existing demo scope", async () => {
    vi.stubEnv("DEMO_SCHOOL_IDS", secondary); expect((await advance()).status).toBe(200);
    expect(await date(0)).toEqual(today); expect((await date(1)).getTime()).toBe(today.getTime() + 86400000); expect(await date(2)).toEqual(today); expect(await date(3)).toEqual(today);
  });
  it("an ordinary school ID cannot be admitted through configuration", async () => {
    vi.stubEnv("DEMO_SCHOOL_IDS", "school-real-test"); expect((await advance()).status).toBe(400); await unchanged();
  });
  it("activity simulation only creates progress for its fixed legacy demo target", async () => {
    expect((await simulate()).status).toBe(200); expect(await db.studentProgress.findMany({ select: { studentId: true } })).toEqual([{ studentId: "sec26-user-3" }]);
    expect(await date(2)).toEqual(today);
  });
  for (const name of ["advance", "simulate"]) {
    const call = () => name === "advance" ? advance() : simulate();
    it(`${name}: ordinary school administrator cannot perform global demo work`, async () => {
      h.userId = "ordinary"; expect((await call()).status).toBe(403); await unchanged();
    });
    it.each(["production", "preview", "staging"])(`${name}: deployed %s refuses even with DEMO_MODE and live-reset opt-in`, async env => {
      vi.stubEnv("VERCEL_ENV", env); expect((await call()).status).toBe(403); await unchanged();
    });
  }
});
