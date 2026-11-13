/** CoS: LL_SEC_15_DB_TEST=1, db_setup=push, disposable loopback PostgreSQL
 * connection_limit=1. Only the session boundary is substituted. No external calls.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "synthetic-admin", role: "ADMIN", schoolId: "", isPlatformAdmin: false } }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (h.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return h.actor;
} }));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_15_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /(?:e2e|test|sec.?15)/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* No admitted disposable target. */ }
if (process.env.LL_SEC_15_DB_TEST === "1" && !admitted) throw new Error("SEC-15 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-15 native teacher sentiment isolation", () => {
  let db: PrismaClient;
  let get: typeof import("@/app/api/admin/sentiment/route").GET;
  const prefix = `sec15-${Date.now().toString(36)}`, a = `${prefix}-A`, b = `${prefix}-B`;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ GET: get } = await import("@/app/api/admin/sentiment/route"));
    await db.school.createMany({ data: [{ id: a, name: "Synthetic A" }, { id: b, name: "Synthetic B" }] });
    const ta = await db.user.create({ data: { email: `${prefix}-a@synthetic.invalid`, role: "TEACHER", schoolId: a } });
    const tb = await db.user.create({ data: { email: `${prefix}-b@synthetic.invalid`, role: "TEACHER", schoolId: b } });
    await db.teacherSentiment.createMany({ data: [{ teacherId: ta.id, schoolId: a, rating: "good" },
      { teacherId: tb.id, schoolId: b, rating: "struggling" }, { teacherId: tb.id, schoolId: b, rating: "struggling" }] });
    h.actor.schoolId = a;
  });
  const read = (schoolId?: string) => get(new Request(`http://localhost/api/admin/sentiment${schoolId ? `?schoolId=${schoolId}` : ""}`));
  it("refuses a foreign-school read", async () => {
    const response = await read(b); expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
  it("returns only the authenticated school's counts", async () => {
    const response = await read(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sentiment: { good: 1, okay: 0, struggling: 0 } });
  });
  it("preserves the existing platform administrator scope", async () => {
    h.actor.isPlatformAdmin = true;
    try { const response = await read(b); expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sentiment: { good: 0, okay: 0, struggling: 2 } });
    } finally { h.actor.isPlatformAdmin = false; }
  });
  it("preserves teacher role refusal", async () => {
    h.actor.role = "TEACHER";
    try { expect((await read()).status).toBe(403); } finally { h.actor.role = "ADMIN"; }
  });
});
