/**
 * Phase 2 (integration/g4-day) interaction: V3 Preview identity freeze × Phase 1a session revocation.
 *
 * Both lines must hold on every identity-changing handler:
 *  - off Preview, a password/PIN change advances the credential version (R1; revokes earlier sessions);
 *  - on a deployed Preview, the handler is refused with PREVIEW_IDENTITY_FROZEN after authority and before any data
 *    work, so no account write and no version advance happens (V3 d650f021 / 094ff19c).
 * Handlers the session line added or changed must be frozen too: POST /api/platform/security/sessions/revoke (new; it
 * can disable accounts), and attach-demo-school / seed-demo, whose school moves now go through updateUserIdentity and
 * advance the credential version.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const dataWork = vi.fn((name: string) => { throw new Error(`data work reached: ${name}`); });
  const prisma: Record<string, any> = {
    student: { findFirst: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    school: { findUnique: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  return {
    prisma,
    dataWork,
    requireRole: vi.fn(),
    requireMoePlatformAdmin: vi.fn(),
    advanceSecurityStamp: vi.fn(async () => new Date()),
    revokeAllSessions: vi.fn(async () => undefined),
    updateUserIdentity: vi.fn(async () => ({})),
    audit: vi.fn(async () => undefined),
  };
});
vi.mock("@/lib/auth", () => ({ requireRole: m.requireRole, requireUser: m.requireRole }));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: m.requireMoePlatformAdmin }));
vi.mock("@/lib/auth/privilegedIdentity", () => ({ isPrivilegedMfaEnforced: () => true, hasRecentPrivilegedStepUp: () => true }));
vi.mock("@/lib/db", () => ({ prisma: m.prisma }));
vi.mock("@/lib/audit", () => ({ logAudit: m.audit, logAuditRequired: m.audit }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "hashed"), compare: vi.fn(async () => true) } }));
vi.mock("@/lib/auth/sessionRevocation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/sessionRevocation")>("@/lib/auth/sessionRevocation");
  return { ...actual, advanceSecurityStamp: m.advanceSecurityStamp, revokeAllSessions: m.revokeAllSessions, updateUserIdentity: m.updateUserIdentity };
});

const json = (url: string, body: unknown, method = "POST") =>
  new Request(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json", Origin: new URL(url).origin, "Sec-Fetch-Site": "same-origin" } });
const frozenCode = async (res: Response) => ({ status: res.status, code: (await res.json()).code });

beforeEach(() => {
  vi.clearAllMocks();
  m.requireRole.mockImplementation(async (role: string) => ({ id: "u-1", role, schoolId: "school-1" }));
  m.requireMoePlatformAdmin.mockResolvedValue({ id: "pa-1", role: "ADMIN", isPlatformAdmin: true, schoolId: null });
  m.prisma.student.findFirst.mockResolvedValue({ id: "stu-1", placementTests: [] });
  m.prisma.user.update.mockResolvedValue({ id: "u-1" });
  m.prisma.user.findUnique.mockResolvedValue({ id: "u-1", hashedPwd: "x", schoolId: null, passwordChangedAt: null });
  m.prisma.school.findUnique.mockResolvedValue({ id: "demo-1", name: "Demo" });
  vi.stubEnv("DEMO_SCHOOL_IDS", "demo-1");
});
afterEach(() => vi.unstubAllEnvs());

describe("off Preview: a PIN change still advances the credential version (R1 kept)", () => {
  it("student change-pin writes the PIN and advances the version in one transaction", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { POST } = await import("@/app/api/student/change-pin/route");
    const res = await POST(json("http://localhost/api/student/change-pin", { pin: "4321", confirmPin: "4321" }));
    expect(res.status).toBe(200);
    expect(m.advanceSecurityStamp).toHaveBeenCalledTimes(1);
    expect(m.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("deployed Preview: every identity-changing handler is frozen before data work (V3 kept, session-line handlers included)", () => {
  beforeEach(() => vi.stubEnv("VERCEL_ENV", "preview"));

  it.each([
    ["student change-pin", () => import("@/app/api/student/change-pin/route"), "POST", "http://localhost/api/student/change-pin", { pin: "4321", confirmPin: "4321" }],
    ["teacher change-password", () => import("@/app/api/teacher/change-password/route"), "PATCH", "http://localhost/api/teacher/change-password", { currentPassword: "a", newPassword: "b".repeat(12) }],
    ["platform session revoke (session line)", () => import("@/app/api/platform/security/sessions/revoke/route"), "POST", "http://localhost/api/platform/security/sessions/revoke", { userId: "victim", reason: "INCIDENT_CONTAINMENT" }],
    ["attach-demo-school (session line write path)", () => import("@/app/api/admin/attach-demo-school/route"), "POST", "http://localhost/api/admin/attach-demo-school", {}],
    ["seed-demo (session line write path)", () => import("@/app/api/admin/seed-demo/route"), "POST", "http://localhost/api/admin/seed-demo", {}],
  ] as const)("%s → 403 PREVIEW_IDENTITY_FROZEN, no transaction, no version advance, no revocation", async (_l, load, method, url, body) => {
    const mod: Record<string, (req: Request) => Promise<Response>> = await load() as never;
    const res = await mod[method](json(url, body, method));
    expect(await frozenCode(res)).toEqual({ status: 403, code: "PREVIEW_IDENTITY_FROZEN" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.advanceSecurityStamp).not.toHaveBeenCalled();
    expect(m.revokeAllSessions).not.toHaveBeenCalled();
    expect(m.updateUserIdentity).not.toHaveBeenCalled();
    expect(m.prisma.user.update).not.toHaveBeenCalled();
  });
});
