/** Actual canonical auth and PostgreSQL reads. Infrastructure failure is induced
 * by temporarily renaming this disposable database's User table, then restoring
 * it in finally. No transaction or database response is mocked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ token: null as any }));
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: h.token }) }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: async (_key: string, _ttl: number, read: () => unknown) => read() }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_20_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec20_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external database. */ }
if (process.env.LL_SEC_20_DB_TEST === "1" && !admitted) throw Error("SEC-20 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-20 native session verification failure", () => {
  let db: PrismaClient;
  let auth: typeof import("@/lib/auth");
  beforeAll(async () => {
    vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "false");
    vi.stubEnv("VERCEL_ENV", "");
    ({ prisma: db } = await import("@/lib/db")); auth = await import("@/lib/auth");
    for (const suffix of ["A", "B"]) await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
  });
  beforeEach(async () => {
    await db.school.update({ where: { id: "school-A" }, data: { status: "ACTIVE" } });
    await db.user.upsert({ where: { id: "user-A" }, create: { id: "user-A", email: "student-A@example.invalid", role: "STUDENT", schoolId: "school-A" },
      update: { role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false } });
    h.token = { id: "user-A", email: "student-A@example.invalid", role: "STUDENT", schoolId: "school-A", isPlatformAdmin: false, authTime: Date.now() - 1000, credStamp: 0 };
  });
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); });
  async function unavailable(read: () => Promise<unknown>) {
    await db.$executeRawUnsafe('ALTER TABLE "User" RENAME TO "_sec20_unavailable_user"');
    try { await expect(read()).rejects.toMatchObject({ status: 503, code: "AUTH_VERIFICATION_UNAVAILABLE" }); }
    finally { await db.$executeRawUnsafe('ALTER TABLE "_sec20_unavailable_user" RENAME TO "User"'); }
    expect(await db.user.count()).toBe(1);
  }
  for (const role of ["STUDENT", "TEACHER", "GUARDIAN", "ADMIN"] as const) {
    it(`${role}: verified persisted authority remains legitimate`, async () => {
      await db.user.update({ where: { id: "user-A" }, data: { role } }); h.token.role = role;
      expect(await auth.requireRole(role)).toMatchObject({ id: "user-A", role, schoolId: "school-A" });
    });
    it(`${role}: actual database verification failure denies access`, async () => {
      await db.user.update({ where: { id: "user-A" }, data: { role } }); h.token.role = role;
      await unavailable(() => auth.requireRole(role));
    });
  }
  it("cross-school reassignment invalidates the old school token", async () => {
    await db.user.update({ where: { id: "user-A" }, data: { schoolId: "school-B" } });
    await expect(auth.requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("persisted role changes cannot retain token authority", async () => {
    await db.user.update({ where: { id: "user-A" }, data: { role: "ADMIN" } });
    await expect(auth.requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("actual school suspension retains 403", async () => {
    await db.school.update({ where: { id: "school-A" }, data: { status: "SUSPENDED" } });
    await expect(auth.requireUser()).rejects.toMatchObject({ status: 403 });
  });
  it("actual account deletion retains 401", async () => {
    await db.user.delete({ where: { id: "user-A" } }); await expect(auth.requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("platform authority also receives sanitized refusal during database failure", async () => {
    await db.user.update({ where: { id: "user-A" }, data: { role: "ADMIN", isPlatformAdmin: true } });
    h.token.role = "ADMIN"; h.token.isPlatformAdmin = true; await unavailable(() => auth.requirePlatformAdmin());
  });
});
