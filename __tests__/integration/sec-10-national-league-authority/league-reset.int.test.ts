/** CoS: LL_SEC_10_DB_TEST=1, db_setup=push, disposable loopback PostgreSQL,
 * connection_limit=1. Session and score computation are synthetic adapters;
 * actual national snapshot SQL writes are exercised, with no provider calls.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ actor: { id: "synthetic-admin", role: "ADMIN", schoolId: "school-A", isPlatformAdmin: false }, rows: [] as { schoolId: string; schoolName: string; district: string; rank: number; score: number; pointsTotal: number; enrollmentCount: number }[], compute: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireRole: async (role: string) => {
  if (h.actor.role !== role) throw Object.assign(new Error("Forbidden"), { status: 403 }); return h.actor;
} }));
vi.mock("@/lib/league/weeklyScore", () => ({
  previousWeekWindow: () => ({ weekStart: new Date("2026-11-02T00:00:00Z"), weekEnd: new Date("2026-11-09T00:00:00Z") }),
  computeSchoolWeeklyScores: h.compute, assignDistrictRanks: (rows: unknown) => rows,
}));
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_10_DB_TEST === "1" && ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /^\/(?:e2e|test|sec10)(?:[_-][a-z0-9_-]+)?$/i.test(url.pathname) &&
    url.searchParams.get("connection_limit") === "1";
} catch { /* No admitted disposable target. */ }
if (process.env.LL_SEC_10_DB_TEST === "1" && !admitted) throw new Error("SEC-10 requires disposable loopback PostgreSQL with connection_limit=1");
describe.skipIf(!admitted)("SEC-10 native national reset authority", () => {
  let db: PrismaClient;
  let post: typeof import("@/app/api/admin/league/reset/route").POST;
  const prefix = `sec10-${Date.now().toString(36)}`;
  beforeAll(async () => {
    ({ prisma: db } = await import("@/lib/db")); ({ POST: post } = await import("@/app/api/admin/league/reset/route"));
    h.rows = ["A", "B"].map(name => ({ schoolId: `${prefix}-${name}`, schoolName: "Synthetic", district: prefix,
      rank: 1, score: 1, pointsTotal: 1, enrollmentCount: 1 })); h.compute.mockResolvedValue(h.rows);
  });
  const reset = () => post(new NextRequest("http://localhost/api/admin/league/reset", { method: "POST" }));
  it.each(["school-A", "school-B"])("school ADMIN in %s has no national effects", async schoolId => {
    h.actor.schoolId = schoolId; h.compute.mockClear(); expect((await reset()).status).toBe(403);
    expect(h.compute).not.toHaveBeenCalled(); expect(await db.leagueWeekSnapshot.count({ where: { district: prefix } })).toBe(0);
  });
  it("a platform ADMIN preserves the national operation", async () => {
    h.actor.isPlatformAdmin = true; const response = await reset(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ snapshots_written: 2 });
    expect(await db.leagueWeekSnapshot.count({ where: { district: prefix } })).toBe(2);
  });
});
