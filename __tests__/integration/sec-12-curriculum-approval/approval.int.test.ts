/** Native PostgreSQL: actual permission helper, route SQL and audit writes.
 * Only the authenticated session boundary and paid generation are replaced.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "teacher-A", fresh: true }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({ where: { id: h.userId } });
  if (!user) throw Object.assign(Error("Unauthorized"), { status: 401 });
  if (!roles.includes(user.role)) throw Object.assign(Error("Forbidden"), { status: 403 });
  return { ...user, authProvider: "auth0", mfaVerifiedAt: h.fresh ? Date.now() - 1000 : null,
    assuranceExpiresAt: h.fresh ? Date.now() + 600000 : null };
} }));
vi.mock("@/lib/ai/curriculum-factory", () => ({ generateCurriculumPayload: () => { throw Error("Provider calls forbidden in native acceptance"); } }));
vi.mock("@/lib/rateLimit", () => ({ RATE_LIMIT_POLICIES: { ADMIN: { windowMs: 60000, limit: 100 } },
  checkRateLimit: async () => ({ allowed: true }), getRateLimitHeaders: () => ({}) }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_12_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec12_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external target is admitted. */ }
if (process.env.LL_SEC_12_DB_TEST === "1" && !admitted) throw Error("SEC-12 requires its own disposable IPv4 loopback database");
describe.skipIf(!admitted)("SEC-12 native curriculum approval boundary", () => {
  let db: PrismaClient;
  let routes: Array<[string, (req: Request) => Promise<Response>]>;
  beforeAll(async () => {
    vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "true");
    vi.stubEnv("ENABLE_AB_BLOCK_SCHEDULING", "false");
    vi.stubEnv("ENABLE_ASSIGNMENT_LESSON_LINKAGE", "false");
    vi.stubEnv("ENABLE_VIRTUAL_LABS", "false");
    vi.stubGlobal("fetch", () => { throw Error("External calls forbidden"); });
    ({ prisma: db } = await import("@/lib/db"));
    routes = [
      ["generate", (await import("@/app/api/admin/curriculum/generate/route")).POST],
      ["generate-full-pack", (await import("@/app/api/admin/curriculum/generate-full-pack/route")).POST],
      ["schedule", (await import("@/app/api/admin/curriculum/schedule/route")).POST],
      ["import", (await import("@/app/api/admin/curriculum/import/route")).POST],
      ["upgrade", (await import("@/app/api/admin/curriculum/upgrade/route")).POST],
    ];
    for (const school of ["A", "B"]) {
      await db.school.create({ data: { id: `school-${school}`, name: `Synthetic ${school}` } });
      for (const role of ["TEACHER", "ADMIN"] as const) await db.user.create({ data: {
        id: `${role.toLowerCase()}-${school}`, email: `${role.toLowerCase()}-${school}@example.invalid`, role, schoolId: `school-${school}`,
      } });
      await db.class.create({ data: { id: `class-${school}`, name: "Synthetic Grade 4", subject: "MATH", schoolId: `school-${school}` } });
    }
    await db.curriculumContent.create({ data: { contentId: "synthetic-content", grade: 4, subject: "MATH", contentType: "lesson",
      status: "published", version: "synthetic-1", payload: { title: "Synthetic native fixture" } } });
  });
  beforeEach(() => { h.userId = "teacher-A"; h.fresh = true; });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  const req = (body: unknown = {}) => new Request("http://localhost/api/admin/curriculum/synthetic", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  for (const name of ["generate", "generate-full-pack", "schedule", "import", "upgrade"]) {
    it.each(["A", "B"])(`${name}: a persisted teacher in school %s cannot approve or write`, async school => {
      h.userId = `teacher-${school}`;
      const handler = routes.find(([key]) => key === name)![1];
      const before = [await db.scheduledWork.count(), await db.curriculumContent.count(), await db.auditLog.count()];
      expect((await handler(req())).status).toBe(403);
      expect([await db.scheduledWork.count(), await db.curriculumContent.count(), await db.auditLog.count()]).toEqual(before);
    });
    it(`${name}: persisted administrator requires step-up`, async () => {
      h.userId = "admin-A"; h.fresh = false;
      expect((await routes.find(([key]) => key === name)![1](req())).status).toBe(428);
    });
    it(`${name}: approved administrator reaches existing input validation`, async () => {
      h.userId = "admin-A";
      const input = name === "import" ? new Request("http://localhost/api/admin/curriculum/import", { method: "POST", body: new FormData() }) : req();
      expect((await routes.find(([key]) => key === name)![1](input)).status).toBe(400);
    });
  }
  it("authorized scheduling durably preserves school, actor and audit evidence", async () => {
    h.userId = "admin-A";
    const res = await routes.find(([key]) => key === "schedule")![1](req({ contentId: "synthetic-content", classId: "class-A", scheduledDate: "2026-11-12", schoolId: "school-B", userId: "admin-B" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = await db.scheduledWork.findUniqueOrThrow({ where: { id: body.scheduledWorkId }, include: { class: true } });
    expect(row).toMatchObject({ contentId: "synthetic-content", classId: "class-A", createdById: "admin-A", class: { schoolId: "school-A" } });
    expect(await db.auditLog.findFirst({ where: { action: "curriculum.schedule", resourceId: "synthetic-content" } })).toMatchObject({ userId: "admin-A", schoolId: "school-A" });
  });
  it("authorized school A administrator cannot schedule school B's persisted class", async () => {
    h.userId = "admin-A";
    const before = await db.scheduledWork.count();
    expect((await routes.find(([key]) => key === "schedule")![1](req({ contentId: "synthetic-content", classId: "class-B", scheduledDate: "2026-11-12" }))).status).toBe(404);
    expect(await db.scheduledWork.count()).toBe(before);
    expect(await db.scheduledWork.count({ where: { classId: "class-B" } })).toBe(0);
  });
});
