/** Actual PostgreSQL, MOE scope resolution, permissions, version/policy/audit writes.
 * The authenticated session boundary is replaced with persisted synthetic users.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
const h = vi.hoisted(() => ({ userId: "national" }));
vi.mock("@/lib/auth", () => {
  const requireUser = async () => {
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.findUnique({ where: { id: h.userId } });
    if (!user) throw Object.assign(Error("Unauthorized"), { status: 401 });
    return { ...user, authProvider: "auth0", mfaVerifiedAt: Date.now() - 1000, assuranceExpiresAt: Date.now() + 600000 };
  };
  return { requireUser, requireRole: async (...roles: string[]) => {
    const user = await requireUser(); if (!roles.includes(user.role)) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
  }, requirePlatformAdmin: async () => {
    const user = await requireUser(); if (!user.isPlatformAdmin) throw Object.assign(Error("Forbidden"), { status: 403 }); return user;
  } };
});
let admitted = false;
try {
  const url = new URL(process.env.DATABASE_URL ?? "");
  admitted = process.env.LL_SEC_14_DB_TEST === "1" && url.hostname === "127.0.0.1" && url.port === "55432" &&
    /^\/sec14_t2_\d+$/.test(url.pathname) && url.searchParams.get("connection_limit") === "1";
} catch { /* No external database. */ }
if (process.env.LL_SEC_14_DB_TEST === "1" && !admitted) throw Error("SEC-14 requires its own IPv4 loopback database");
describe.skipIf(!admitted)("SEC-14 native portal admission and district isolation", () => {
  let db: PrismaClient;
  let versions: typeof import("@/app/api/moe/curriculum/version/route");
  let policies: typeof import("@/app/api/moe/policies/route");
  let shell: typeof import("@/lib/moeAccess");
  beforeAll(async () => {
    vi.stubGlobal("fetch", () => { throw Error("External calls forbidden"); });
    vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "true");
    vi.stubEnv("ENABLE_MOE_GOVERNANCE_WORKFLOW", "false");
    vi.stubEnv("ENABLE_CURRICULUM_VERSION_STANDARDIZATION", "false");
    ({ prisma: db } = await import("@/lib/db"));
    versions = await import("@/app/api/moe/curriculum/version/route");
    policies = await import("@/app/api/moe/policies/route");
    shell = await import("@/lib/moeAccess");
    for (const suffix of ["A", "B"]) {
      await db.district.create({ data: { id: `district-${suffix}`, name: `Synthetic ${suffix}`, tenantId: `synthetic-${suffix}`, region: "Synthetic" } });
      await db.school.create({ data: { id: `school-${suffix}`, name: `Synthetic ${suffix}`, districtId: `district-${suffix}` } });
      await db.user.create({ data: { id: `district-${suffix}`, email: `district-${suffix}@example.invalid`, role: "MOE_DISTRICT_ADMIN", schoolId: `school-${suffix}` } });
    }
    for (const [id, role, platform] of [["national", "MOE_SUPER_ADMIN", false], ["platform", "ADMIN", true], ["ordinary", "ADMIN", false]] as const) {
      await db.user.create({ data: { id, email: `${id}@example.invalid`, role, isPlatformAdmin: platform, schoolId: "school-A" } });
    }
    for (const suffix of ["A", "B"]) await db.policyConfig.create({ data: { policyKey: `synthetic-${suffix}`, scope: "DISTRICT", districtId: `district-${suffix}`, config: {}, createdById: "national" } });
  });
  beforeEach(() => { h.userId = "national"; vi.stubEnv("ENABLE_MOE_PORTAL", "true"); vi.stubEnv("MOE_PORTAL_ALLOWLIST", ""); });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await db?.$disconnect(); });
  const req = (body: unknown) => new NextRequest("http://localhost/api/moe/curriculum/version", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  it("disabled portal refuses a national version write without persistence or audit", async () => {
    vi.stubEnv("ENABLE_MOE_PORTAL", "false");
    expect((await versions.POST(req({ versionName: "disabled" }))).status).toBe(404);
    expect(await db.curriculumVersion.count()).toBe(0); expect(await db.auditLog.count()).toBe(0);
  });
  it("enabled national version creation persists the canonical actor and audit", async () => {
    const res = await versions.POST(req({ versionName: "Synthetic native version", createdById: "ordinary" })); expect(res.status).toBe(201);
    const { version } = await res.json();
    expect(await db.curriculumVersion.findUnique({ where: { id: version.id } })).toMatchObject({ createdById: "national", status: "DRAFT" });
    expect(await db.auditLog.findFirst({ where: { resourceId: version.id } })).toMatchObject({ action: "moe.curriculum_version.created", userId: "national" });
  });
  it.each(["A", "B"])("persisted district %s only reads its own policies", async suffix => {
    h.userId = `district-${suffix}`;
    const res = await policies.GET(); expect(res.status).toBe(200); const body = await res.json();
    expect(body.scope.schoolIds).toEqual([`school-${suffix}`]);
    expect(body.policies.map((p: { policyKey: string }) => p.policyKey)).toEqual([`synthetic-${suffix}`]);
  });
  it("district authority cannot write national versions or policies", async () => {
    h.userId = "district-A"; const before = [await db.curriculumVersion.count(), await db.policyConfig.count(), await db.auditLog.count()];
    expect((await versions.POST(req({ versionName: "forbidden" }))).status).toBe(403);
    expect((await policies.POST(req({ policyKey: "forbidden", scope: "NATIONAL", config: {} }))).status).toBe(403);
    expect([await db.curriculumVersion.count(), await db.policyConfig.count(), await db.auditLog.count()]).toEqual(before);
  });
  it("ordinary school administrator cannot read national versions", async () => { h.userId = "ordinary"; expect((await versions.GET()).status).toBe(403); });
  it("legacy shell denies a platform administrator with an empty allowlist", async () => {
    h.userId = "platform"; await expect(shell.requireMoePortalUser()).rejects.toMatchObject({ status: 403 });
  });
  it("legacy shell admits an explicitly allowlisted platform administrator", async () => {
    h.userId = "platform"; vi.stubEnv("MOE_PORTAL_ALLOWLIST", "platform@example.invalid");
    expect(await shell.requireMoePortalUser()).toMatchObject({ id: "platform", isPlatformAdmin: true });
  });
  it("allowlisting cannot elevate an ordinary school administrator", async () => {
    h.userId = "ordinary"; vi.stubEnv("MOE_PORTAL_ALLOWLIST", "ordinary@example.invalid");
    await expect(shell.requireMoePortalUser()).rejects.toMatchObject({ status: 403 });
  });
});
