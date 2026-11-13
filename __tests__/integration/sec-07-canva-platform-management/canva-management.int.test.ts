/** CoS: LL_SEC_07_DB_TEST=1, db_setup=push, disposable loopback PostgreSQL,
 * connection_limit=1. Real credential deletion; session/step-up only are replaced.
 * Uses a synthetic token envelope and never calls Canva or other providers.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "synthetic-admin", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false }, stepUp: true }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (h.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return h.actor;
}, requirePrivilegedStepUp: async () => {
  if (!h.stepUp) throw Object.assign(new Error("Step-up required"), { status: 403 }); return h.actor;
} }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_07_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /^\/(?:e2e|test|sec07)(?:[_-][a-z0-9_-]+)?$/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* Not an admitted disposable target. */ }
if (process.env.LL_SEC_07_DB_TEST === "1" && !admitted) throw new Error("SEC-07 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-07 native global credential authority", () => {
  let db: PrismaClient;
  let remove: typeof import("@/app/api/admin/canva/disconnect/route").DELETE;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ DELETE: remove } = await import("@/app/api/admin/canva/disconnect/route"));
  });
  beforeEach(async () => {
    h.actor = { id: "synthetic-admin", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false }; h.stepUp = true;
    await db.canvaOAuthCredential.upsert({ where: { provider: "canva" },
      create: { provider: "canva", encryptedTokenSet: "synthetic-envelope-not-a-real-token" }, update: {} });
  });
  it.each(["school-A", "school-B"])("school ADMIN in %s cannot delete the credential", async schoolId => {
    h.actor.schoolId = schoolId; expect((await remove()).status).toBe(403);
    expect(await db.canvaOAuthCredential.count({ where: { provider: "canva" } })).toBe(1);
  });
  it("requires step-up even for platform ADMIN", async () => {
    h.actor.isPlatformAdmin = true; h.stepUp = false; expect((await remove()).status).toBe(403);
    expect(await db.canvaOAuthCredential.count({ where: { provider: "canva" } })).toBe(1);
  });
  it("lets a stepped-up platform ADMIN delete the global credential", async () => {
    h.actor.isPlatformAdmin = true; expect((await remove()).status).toBe(200);
    expect(await db.canvaOAuthCredential.count({ where: { provider: "canva" } })).toBe(0);
  });
});
