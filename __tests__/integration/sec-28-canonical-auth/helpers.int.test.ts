/** Canonical auth reads real PostgreSQL. Only the signed-session boundary and
 * Redis adapter are replaced; no database/transaction response is mocked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ token: null as any }));
vi.mock("next-auth", () => ({ getServerSession: async () => h.token ? { user: h.token } : null }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: async (_key: string, _ttl: number, read: () => unknown) => read() }));
let admitted = false;
try { const url = new URL(process.env.DATABASE_URL ?? ""); admitted = process.env.LL_SEC_28_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" && /^\/sec28_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1"; } catch { /* Local only. */ }
if (process.env.LL_SEC_28_DB_TEST === "1" && !admitted) throw Error("SEC-28 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-28 native legacy helper authority", () => {
  let db: PrismaClient; let helpers: typeof import("@/lib/auth-helpers");
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("No external calls"); });
    ({ prisma: db } = await import("@/lib/db")); helpers = await import("@/lib/auth-helpers");
    for (const suffix of ["A", "B"]) await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}` } });
  });
  beforeEach(async () => {
    vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "false"); vi.stubEnv("VERCEL_ENV", "");
    await db.school.update({ where: { id: "school-A" }, data: { status: "ACTIVE" } });
    await db.user.upsert({ where: { id: "user-A" }, create: { id: "user-A", email: "teacher@example.invalid", role: "TEACHER", schoolId: "school-A" },
      update: { role: "TEACHER", schoolId: "school-A", isPlatformAdmin: false, passwordChangedAt: null } });
    h.token = { id: "user-A", email: "teacher@example.invalid", role: "TEACHER", schoolId: "school-A", isPlatformAdmin: false, authTime: Date.now() - 1000, credStamp: 0 };
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  for (const name of ["auth", "role"]) {
    const call = () => name === "auth" ? helpers.requireAuth() : helpers.requireRole(["TEACHER"]);
    const denied = async (status: number) => { const result = await call(); expect(result).toHaveProperty("status", status); };
    it(`${name}: valid current account preserves the session.user return shape`, async () => {
      expect(await call()).toMatchObject({ session: { user: { id: "user-A", role: "TEACHER", schoolId: "school-A" } } });
    });
    it(`${name}: anonymous request remains 401`, async () => { h.token = null; await denied(401); });
    it(`${name}: deleted account cannot retain raw-session authority`, async () => { await db.user.delete({ where: { id: "user-A" } }); await denied(401); });
    it(`${name}: role changes invalidate old claims`, async () => { await db.user.update({ where: { id: "user-A" }, data: { role: "ADMIN" } }); await denied(401); });
    it(`${name}: school reassignment invalidates old-school authority`, async () => { await db.user.update({ where: { id: "user-A" }, data: { schoolId: "school-B" } }); await denied(401); });
    it(`${name}: school suspension retains 403`, async () => { await db.school.update({ where: { id: "school-A" }, data: { status: "SUSPENDED" } }); await denied(403); });
    it(`${name}: changed credentials invalidate the token version`, async () => { await db.user.update({ where: { id: "user-A" }, data: { passwordChangedAt: new Date(1) } }); await denied(401); });
    it(`${name}: missing identity cannot acquire a session`, async () => { delete h.token.id; await denied(401); });
    it(`${name}: forged platform flag cannot override the persisted account`, async () => { h.token.isPlatformAdmin = true; await denied(401); });
  }
  it("verified teacher remains forbidden from ADMIN-only roles", async () => { expect(await helpers.requireRole(["ADMIN"])).toHaveProperty("status", 403); });
  it("an empty allowed-role list remains deny-by-default", async () => { expect(await helpers.requireRole([])).toHaveProperty("status", 403); });
  it("MFA-on privileged account without current assurance cannot use the legacy helper", async () => {
    await db.user.update({ where: { id: "user-A" }, data: { role: "ADMIN" } }); h.token.role = "ADMIN";
    vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "true"); expect(await helpers.requireRole(["ADMIN"])).toHaveProperty("status", 401);
  });
  it("privileged infrastructure failure is sanitized and denied", async () => {
    await db.user.update({ where: { id: "user-A" }, data: { role: "ADMIN" } }); h.token.role = "ADMIN";
    await db.$executeRawUnsafe('ALTER TABLE "User" RENAME TO "_sec28_unavailable_user"');
    try {
      const result = await helpers.requireAuth(); expect(result).toHaveProperty("status", 503);
      expect(await (result as Response).json()).toEqual({ error: "Authentication verification unavailable" });
    } finally { await db.$executeRawUnsafe('ALTER TABLE "_sec28_unavailable_user" RENAME TO "User"'); }
  });
});
