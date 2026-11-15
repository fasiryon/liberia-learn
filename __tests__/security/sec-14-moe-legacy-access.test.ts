import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ enabled: true, allowlist: [] as string[], actor: null as any, authReads: 0 }));
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  m.authReads++; if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
}, requirePlatformAdmin: async () => { m.authReads++;
  if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (m.actor.isPlatformAdmin !== true) throw Object.assign(new Error("Forbidden"), { status: 403 }); return m.actor;
} }));
vi.mock("@/lib/serverFlags", () => ({ isMoePortalEnabled: () => m.enabled, getMoePortalAllowlist: () => m.allowlist }));
import { requireMoePlatformAdmin, requireMoePortalUser } from "@/lib/moeAccess";
beforeEach(() => { m.enabled = true; m.allowlist = ["official@example.invalid"]; m.authReads = 0;
  m.actor = { id: "synthetic-platform", role: "ADMIN", schoolId: "school-A", email: "official@example.invalid", isPlatformAdmin: true }; });
afterEach(() => vi.unstubAllEnvs());
for (const [name, guard] of [["legacy portal shell", requireMoePortalUser], ["platform operations", requireMoePlatformAdmin]] as const) describe(name, () => {
  it("empty allowlist denies instead of allowing every account", async () => { m.allowlist = []; await expect(guard()).rejects.toMatchObject({ status: 403 }); });
  it("portal off refuses before authentication", async () => { m.enabled = false; await expect(guard()).rejects.toMatchObject({ status: 404 }); expect(m.authReads).toBe(0); });
  it("explicitly allowlisted platform admin remains legitimate", async () => { expect(await guard()).toBe(m.actor); });
  it("foreign or absent email is refused", async () => { m.actor.email = "other@foreign.invalid"; await expect(guard()).rejects.toMatchObject({ status: 403 });
    m.actor.email = null; await expect(guard()).rejects.toMatchObject({ status: 403 }); });
  it("school admin cannot acquire platform authority", async () => { m.actor.isPlatformAdmin = false; await expect(guard()).rejects.toMatchObject({ status: 403 }); });
  it("ordinary district admin cannot acquire platform authority", async () => { m.actor = { ...m.actor, role: "DISTRICT_ADMIN", isPlatformAdmin: false }; await expect(guard()).rejects.toMatchObject({ status: 403 }); });
  it("explicit domain entry and normalized email still work", async () => { m.allowlist = ["example.invalid"]; m.actor.email = "  OFFICIAL@EXAMPLE.INVALID "; expect(await guard()).toBe(m.actor); });
});
it.each(["STUDENT", "TEACHER", "GUARDIAN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN"])("legacy shell does not gain a new %s role", async role => {
  m.actor = { ...m.actor, role, isPlatformAdmin: false }; await expect(requireMoePortalUser()).rejects.toMatchObject({ status: 403 });
});
