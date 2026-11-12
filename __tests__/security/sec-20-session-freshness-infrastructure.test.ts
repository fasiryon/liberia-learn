import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ token: null as any, row: null as any, dbError: null as any, cacheError: null as any,
  dbReads: 0, protectedEffects: 0 }));
vi.mock("next-auth", () => ({ getServerSession: async () => m.token ? { user: m.token } : null }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: async () => { m.dbReads++; if (m.dbError) throw m.dbError; return m.row; } } } }));
vi.mock("@/lib/cache/redisCache", () => ({ withRedisCache: async (_key: string, _ttl: number, fn: () => unknown) => { if (m.cacheError) throw m.cacheError; return fn(); } }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAuditRequired: vi.fn(), logAudit: vi.fn() }));
import { requireRole, requireUser, requirePlatformAdmin } from "@/lib/auth";
const roles = ["STUDENT", "TEACHER", "GUARDIAN", "ADMIN", "DISTRICT_ADMIN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN"];
function identity(role = "STUDENT") {
  m.token = { id: "synthetic-" + role, role, schoolId: "school-A", isPlatformAdmin: false, authTime: Date.now() - 1000, credStamp: 0 };
  m.row = { passwordChangedAt: null, role, schoolId: "school-A", isPlatformAdmin: false, school: { status: "ACTIVE" } };
}
beforeEach(() => { vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "false"); vi.stubEnv("VERCEL_ENV", "");
  m.dbError = null; m.cacheError = null; m.dbReads = 0; m.protectedEffects = 0; identity(); });
afterEach(() => vi.unstubAllEnvs());
const protectedRead = async () => { const user = await requireUser(); m.protectedEffects++; return user; };
for (const role of roles) describe(role, () => {
  it("unverifiable DB authority returns retryable refusal instead of a user", async () => {
    identity(role); m.dbError = Error("synthetic private infrastructure diagnostic");
    await expect(protectedRead()).rejects.toMatchObject({ status: 503, code: "AUTH_VERIFICATION_UNAVAILABLE" }); expect(m.protectedEffects).toBe(0);
  });
  it("verified current identity remains legitimate", async () => {
    identity(role); expect(await protectedRead()).toMatchObject({ id: m.token.id, role, schoolId: "school-A" }); expect(m.protectedEffects).toBe(1); expect(m.dbReads).toBe(1);
  });
});
it.each(["STUDENT", "TEACHER", "GUARDIAN"])("cache failure cannot admit non-privileged %s", async role => {
  identity(role); m.cacheError = Error("synthetic cache outage"); await expect(protectedRead()).rejects.toMatchObject({ status: 503 }); expect(m.protectedEffects).toBe(0);
});
it.each(["STUDENT", "TEACHER", "GUARDIAN"])("requireRole also refuses unverified %s authority", async role => {
  identity(role); m.dbError = Error("synthetic outage"); await expect(requireRole(role)).rejects.toMatchObject({ status: 503 });
});
it("inactive-school denial remains 403", async () => { m.row.school.status = "SUSPENDED"; await expect(requireUser()).rejects.toMatchObject({ status: 403 }); });
it("changed credential denial remains 401", async () => { m.row.passwordChangedAt = new Date(1); await expect(requireUser()).rejects.toMatchObject({ status: 401 }); });
it("changed school cannot retain authority from the token", async () => { m.row.schoolId = "school-B"; await expect(requireUser()).rejects.toMatchObject({ status: 401 }); });
it("changed role cannot retain authority from the token", async () => { m.row.role = "ADMIN"; await expect(requireUser()).rejects.toMatchObject({ status: 401 }); });
it("deleted account remains 401", async () => { m.row = null; await expect(requireUser()).rejects.toMatchObject({ status: 401 }); });
it("anonymous access remains 401 without querying the database", async () => { m.token = null; await expect(requireUser()).rejects.toMatchObject({ status: 401 }); expect(m.dbReads).toBe(0); });
it("verified lower role is not widened", async () => { await expect(requireRole("ADMIN")).rejects.toMatchObject({ status: 403 }); });
it("platform authority is also refused while freshness is unavailable", async () => {
  identity("ADMIN"); m.token.isPlatformAdmin = true; m.row.isPlatformAdmin = true; m.dbError = Error("synthetic outage");
  await expect(requirePlatformAdmin()).rejects.toMatchObject({ status: 503 });
});
it("unavailable-authority error does not expose infrastructure diagnostics", async () => {
  m.dbError = Error("synthetic private infrastructure diagnostic"); const error = await requireUser().catch(err => err);
  expect(error).toMatchObject({ status: 503 }); expect(error.message).not.toContain("private infrastructure");
});
