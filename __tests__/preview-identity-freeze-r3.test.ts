/**
 * Preview identity freeze, Revision 3 (Atlas ATLAS-T1-PROVISIONING-5daefe7c-VERDICT, T2 independent review,
 * CoS routing 2026-11-02). Direct handler calls:
 *  - protected routes refuse AFTER their existing authority and BEFORE the request body is read; unauthenticated
 *    and wrong-role callers get byte-identical responses in Preview and Production (existing denials preserved);
 *  - public entry points refuse first, without manufacturing authentication;
 *  - platform transfer tokens, own PIN/password changes and guardian link acceptance are frozen;
 *  - confirmed B5 roster/academic routes refuse with PREVIEW_RECORDS_FROZEN after authority;
 *  - admin/school freezes its whole PATCH (malformed bodies too) and exposes only fixed error text on Preview;
 *  - Production positive controls: the same authorized call proceeds past the guard (reads the body or reaches
 *    data work); staging and DEMO_MODE variants freeze like Preview.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Actor = { id: string; role: string; schoolId: string | null; isPlatformAdmin: boolean; email: string };
const m = vi.hoisted(() => ({
  actor: { current: null as null | Actor },
  authFail: { current: null as null | Error },
  auth: vi.fn(),
  db: vi.fn(),
  provider: vi.fn(),
  body: vi.fn(),
}));
const deny = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
const current = () => {
  m.auth();
  if (m.authFail.current) throw m.authFail.current;
  return m.actor.current ?? deny(401, "Unauthorized");
};
const platform = async () => { const a = current(); if (!a.isPlatformAdmin) deny(403, "Forbidden"); return a; };
vi.mock("@/lib/auth", () => ({
  requireUser: async () => current(),
  requireRole: async (...roles: string[]) => { const a = current(); if (!roles.includes(a.role)) deny(403, "Forbidden"); return a; },
  requirePlatformAdmin: platform,
  // Models isPrivilegedAccount: only platform/MoE admins hold a privileged identity.
  requirePrivilegedStepUp: async (u?: Actor) => { const a = u ?? current(); m.auth(); if (!a.isPlatformAdmin) deny(403, "Forbidden"); return a; },
  getOptionalUser: async () => m.actor.current,
  authOptions: {},
}));
vi.mock("@/lib/moeAccess", () => ({ requireMoePlatformAdmin: platform }));
vi.mock("next-auth", () => ({ getServerSession: async () => { m.auth(); return m.actor.current ? { user: m.actor.current } : null; } }));
vi.mock("@/lib/db", () => {
  const deep: any = new Proxy(function () {}, { get: (_t, key) => (key === "then" ? undefined : deep), apply: () => { m.db(); throw Error("unexpected_database_access"); } });
  return { prisma: deep, rdsPrisma: null, isRdsDualWriteEnabled: () => false, logRdsDualWriteError: () => undefined };
});
vi.mock("@/lib/email", async o => ({ ...(await o<object>()), sendEmail: m.provider }));
vi.mock("@/lib/credentials", async o => ({ ...(await o<object>()), sendCredentialSms: m.provider }));
vi.mock("@/lib/rateLimit", async o => ({ ...(await o<object>()), checkRateLimit: async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 1000 }) }));
vi.mock("@/lib/serverFlags", async o => ({
  ...(await o<object>()),
  isMoePortalEnabled: () => true,
  isGuardianLinkingEnabled: () => true,
  isEnrollmentInvitesEnabled: () => true,
}));

type Handler = (req: Request, ctx: { params: any }) => Promise<Response>;
const A = {
  schoolAdmin: { id: "s-admin", role: "ADMIN", schoolId: "g4-e2e-school", isPlatformAdmin: false, email: "admin@synthetic.invalid" },
  platformAdmin: { id: "p-admin", role: "ADMIN", schoolId: "g4-e2e-school", isPlatformAdmin: true, email: "p@synthetic.invalid" },
  teacher: { id: "t", role: "TEACHER", schoolId: "g4-e2e-school", isPlatformAdmin: false, email: "t@synthetic.invalid" },
  student: { id: "stu", role: "STUDENT", schoolId: "g4-e2e-school", isPlatformAdmin: false, email: "s@synthetic.invalid" },
  guardian: { id: "g", role: "GUARDIAN", schoolId: "g4-e2e-school", isPlatformAdmin: false, email: "g@synthetic.invalid" },
} satisfies Record<string, Actor>;

/** [route, method, authorized actor, wrong-role actor, expected Preview code] */
const PROTECTED: Array<[string, string, Actor, Actor, string]> = [
  ["admin/interoperability/oneroster/import", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/import", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/import/confirm", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/import/batches/[id]/credentials", "GET", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/onboarding/import-students", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/onboarding/import-teachers", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/students", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/teachers", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/teachers", "PATCH", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/guardian-link", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/invites", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["onboard/invite", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["rollout/invite/teacher", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["rollout/invite/student", "POST", A.teacher, A.student, "PREVIEW_IDENTITY_FROZEN"],
  ["rollout/invite/student/bulk", "POST", A.teacher, A.student, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/students/[id]/generate-reset-code", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/credentials/send", "POST", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/schools/pending", "POST", A.platformAdmin, A.schoolAdmin, "PREVIEW_IDENTITY_FROZEN"],
  ["platform/security/accept", "POST", A.platformAdmin, A.student, "PREVIEW_IDENTITY_FROZEN"],
  ["platform/security/demote", "POST", A.platformAdmin, A.schoolAdmin, "PREVIEW_IDENTITY_FROZEN"],
  ["platform/security/transfer", "POST", A.platformAdmin, A.schoolAdmin, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/security/mfa/recovery/reset", "POST", A.platformAdmin, A.schoolAdmin, "PREVIEW_IDENTITY_FROZEN"],
  ["student/change-pin", "POST", A.student, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["teacher/change-password", "PATCH", A.teacher, A.student, "PREVIEW_IDENTITY_FROZEN"],
  ["guardian/link", "POST", A.guardian, A.student, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/school", "PATCH", A.schoolAdmin, A.teacher, "PREVIEW_IDENTITY_FROZEN"],
  ["admin/students/[id]", "PATCH", A.schoolAdmin, A.teacher, "PREVIEW_RECORDS_FROZEN"],
  ["admin/enrollment", "POST", A.schoolAdmin, A.teacher, "PREVIEW_RECORDS_FROZEN"],
  ["admin/enrollment", "PATCH", A.schoolAdmin, A.teacher, "PREVIEW_RECORDS_FROZEN"],
];
/** Routes whose Preview/staging catch returns lib/preview/safeError fixed bodies. */
const SANITIZED = new Set([
  "admin/school", "platform/security/transfer", "teacher/change-password", "admin/import", "admin/import/batches/[id]/credentials",
  "admin/onboarding/import-students", "admin/onboarding/import-teachers", "admin/students", "admin/teachers", "admin/guardian-link",
  "admin/invites", "onboard/invite", "rollout/invite/teacher", "rollout/invite/student", "rollout/invite/student/bulk",
  "admin/credentials/send", "admin/schools/pending", "platform/security/accept", "platform/security/demote",
  "admin/security/mfa/recovery/reset", "guardian/link", "admin/students/[id]",
]);
const FIXED_DENIAL: Record<number, { error: string; code: string }> = {
  401: { error: "Unauthorized", code: "UNAUTHORIZED" }, 403: { error: "Forbidden", code: "FORBIDDEN" },
  404: { error: "Not found", code: "NOT_FOUND" }, 400: { error: "Bad request", code: "BAD_REQUEST" },
};
const PUBLIC: Array<[string, string]> = [
  ["register/student", "POST"], ["register/guardian", "POST"], ["guardian/register", "POST"], ["enroll", "POST"],
  ["auth/forgot-password", "POST"], ["auth/reset-password", "POST"], ["auth/reset-with-code", "POST"], ["onboard/accept", "POST"],
];

const BODY = JSON.stringify({
  email: "new@synthetic.invalid", name: "x", password: "synthetic-new-password-0123", role: "ADMIN", students: [], teachers: [],
  rows: [], batchId: "b", token: "t", code: "123456", userId: "u", schoolId: "g4-e2e-school", intendedUserId: "u2",
  pin: "1234", confirmPin: "1234", currentPassword: "synthetic-old-0123", newPassword: "synthetic-new-0123",
  action: "createClass", subject: "MATH", targetClassId: "c2", studentId: "stu", academicYearId: "y", enrollmentId: "e", status: "ACTIVE",
});
function request(route: string, method: string, body: string = BODY) {
  const req = new Request(`https://preview.synthetic.invalid/api/${route.replace(/\[id\]/g, "x")}`, {
    method, headers: { "content-type": "application/json" }, ...(method === "GET" ? {} : { body }),
  });
  for (const key of ["json", "formData", "text", "arrayBuffer"] as const) {
    const original = (req as any)[key].bind(req);
    (req as any)[key] = (...args: unknown[]) => { m.body(key); return original(...args); };
  }
  return req;
}
async function call(route: string, method: string, body?: string) {
  const mod = (await import(`@/app/api/${route}/route`)) as Record<string, Handler>;
  const params = { id: "x" };
  const res = await mod[method](request(route, method, body), { params: Object.assign(Promise.resolve(params), params) });
  const text = await res.clone().text();
  let json: any = null;
  // Trace/request identifiers and timestamps differ per call; everything else must match byte for byte.
  const stable = text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<time>");
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, text: stable, json };
}
const env = (vercelEnv: string | undefined, demo = false) => {
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", "production");
  if (vercelEnv) vi.stubEnv("VERCEL_ENV", vercelEnv);
  if (demo) vi.stubEnv("DEMO_MODE", "true");
};
const reset = () => { vi.clearAllMocks(); m.actor.current = null; m.authFail.current = null; };
beforeEach(reset);
afterEach(() => { vi.unstubAllEnvs(); reset(); });

describe("protected routes: authority first, freeze before the body", () => {
  it.each(PROTECTED)("RED: authorized %s %s is frozen after authority, before body/data/provider work", async (route, method, ok, _bad, code) => {
    env("preview"); m.actor.current = ok;
    const res = await call(route, method);
    expect(res.status).toBe(403);
    expect(res.json?.code).toBe(code);
    expect(m.auth).toHaveBeenCalled();
    expect(m.body).not.toHaveBeenCalled();
    expect(m.db).not.toHaveBeenCalled();
    expect(m.provider).not.toHaveBeenCalled();
  });
  it.each(PROTECTED)("RED: unauthenticated %s %s keeps its existing denial (identical to Production)", async (route, method) => {
    env("production"); const prod = await call(route, method); reset();
    env("preview"); const prev = await call(route, method);
    expect(prev.json?.code).not.toBe("PREVIEW_IDENTITY_FROZEN");
    expect(prev.json?.code).not.toBe("PREVIEW_RECORDS_FROZEN");
    expect([401, 403, 404]).toContain(prev.status);
    expect(prev.status).toBe(prod.status);
    // Sanitized surfaces (T2 P2, Atlas R3 P2) return exactly a fixed body on Preview; all others stay byte-identical.
    if (SANITIZED.has(route) && prev.text !== prod.text) expect(prev.json).toEqual(FIXED_DENIAL[prev.status]);
    else expect(prev.text).toBe(prod.text);
    expect(m.body).not.toHaveBeenCalled();
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each(PROTECTED)("RED: wrong-role %s %s keeps its existing denial (identical to Production)", async (route, method, _ok, bad) => {
    env("production"); m.actor.current = bad; const prod = await call(route, method); reset();
    env("preview"); m.actor.current = bad; const prev = await call(route, method);
    expect(prev.json?.code).not.toBe("PREVIEW_IDENTITY_FROZEN");
    expect(prev.json?.code).not.toBe("PREVIEW_RECORDS_FROZEN");
    expect([401, 403, 404]).toContain(prev.status);
    expect(prev.status).toBe(prod.status);
    // Sanitized surfaces (T2 P2, Atlas R3 P2) return exactly a fixed body on Preview; all others stay byte-identical.
    if (SANITIZED.has(route) && prev.text !== prod.text) expect(prev.json).toEqual(FIXED_DENIAL[prev.status]);
    else expect(prev.text).toBe(prod.text);
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each(PROTECTED)("Production positive control: authorized %s %s proceeds past the guard", async (route, method, ok) => {
    env("production"); m.actor.current = ok;
    const res = await call(route, method).catch(() => null);
    expect(res?.json?.code).not.toBe("PREVIEW_IDENTITY_FROZEN");
    expect(m.auth).toHaveBeenCalled();
    expect(m.body.mock.calls.length + m.db.mock.calls.length + m.provider.mock.calls.length).toBeGreaterThan(0);
  });
  it.each([
    ["staging", false], ["preview", true], ["staging", true],
  ] as const)("RED: VERCEL_ENV=%s DEMO_MODE=%s freezes transfer, own PIN and B5 class move like Preview", async (vercelEnv, demo) => {
    for (const [route, method, actor, code] of [
      ["platform/security/transfer", "POST", A.platformAdmin, "PREVIEW_IDENTITY_FROZEN"],
      ["student/change-pin", "POST", A.student, "PREVIEW_IDENTITY_FROZEN"],
      ["admin/students/[id]", "PATCH", A.schoolAdmin, "PREVIEW_RECORDS_FROZEN"],
    ] as const) {
      reset(); env(vercelEnv, demo); m.actor.current = actor;
      const res = await call(route, method);
      expect([route, res.status, res.json?.code]).toEqual([route, 403, code]);
      expect(m.db).not.toHaveBeenCalled();
    }
  });
  it("Production with DEMO_MODE=true is not frozen (DEMO_MODE never selects the freeze)", async () => {
    env("production", true); m.actor.current = A.student;
    const res = await call("student/change-pin", "POST").catch(() => null);
    expect(res?.json?.code).not.toBe("PREVIEW_IDENTITY_FROZEN");
    expect(m.body).toHaveBeenCalled();
  });
});

describe("public entry points refuse first", () => {
  it.each(PUBLIC)("%s %s is frozen without authentication, body or data work", async (route, method) => {
    env("preview");
    const res = await call(route, method);
    expect(res.status).toBe(403);
    expect(res.json?.code).toBe("PREVIEW_IDENTITY_FROZEN");
    expect(m.body).not.toHaveBeenCalled();
    expect(m.db).not.toHaveBeenCalled();
  });
});

describe("admin/school PATCH", () => {
  it.each([
    ["inviteTeacher", { action: "inviteTeacher", fullName: "Synthetic Teacher", email: "t@synthetic.invalid" }],
    ["deactivateTeacher", { action: "deactivateTeacher", teacherId: "g4-e2e-teacher" }],
    ["createClass", { action: "createClass", name: "Class X", subject: "MATH", gradeLevel: 4 }],
    ["moveStudent", { action: "moveStudent", studentId: "stu", targetClassId: "c2" }],
    ["updateProfile", { action: "updateProfile", name: "Renamed School" }],
  ])("RED: %s is frozen in Preview after authority and before body parsing", async (_n, action) => {
    env("preview"); m.actor.current = A.schoolAdmin;
    const res = await call("admin/school", "PATCH", JSON.stringify(action));
    expect([res.status, res.json?.code]).toEqual([403, "PREVIEW_IDENTITY_FROZEN"]);
    expect(m.auth).toHaveBeenCalled();
    expect(m.body).not.toHaveBeenCalled();
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each(["{not json", "", JSON.stringify({ action: "unknown" })])("RED: malformed body %j fails closed in Preview", async body => {
    env("preview"); m.actor.current = A.schoolAdmin;
    const res = await call("admin/school", "PATCH", body);
    expect([res.status, res.json?.code]).toEqual([403, "PREVIEW_IDENTITY_FROZEN"]);
  });
  it("RED: an infrastructure failure inside authentication exposes only generic text on Preview", async () => {
    env("preview"); m.authFail.current = new Error("PRIVATE_MARKER_freshness_read_failed");
    for (const method of ["PATCH", "GET"]) {
      const res = await call("admin/school", method);
      expect(res.status).toBe(500);
      expect(res.text).not.toContain("PRIVATE_MARKER");
      expect(res.json).toEqual({ error: "Internal error", code: "INTERNAL_ERROR" });
    }
  });
  it.each([
    ["missing session", null, 401, "UNAUTHORIZED"],
    ["wrong role", A.teacher, 403, "FORBIDDEN"],
    ["admin without school", { ...A.schoolAdmin, schoolId: null }, 400, "BAD_REQUEST"],
  ] as const)("RED: Preview %s keeps its status with a fixed code", async (_n, actor, status, code) => {
    env("preview"); m.actor.current = actor as Actor | null;
    const res = await call("admin/school", "PATCH");
    expect(res.status).toBe(status);
    expect(res.json?.code).toBe(code);
  });
  it("Production error text is unchanged (Preview-only sanitizing)", async () => {
    env("production"); m.authFail.current = new Error("PRIVATE_MARKER_freshness_read_failed");
    const res = await call("admin/school", "PATCH");
    expect(res.status).toBe(500);
    expect(res.json?.error).toBe("PRIVATE_MARKER_freshness_read_failed");
  });
});

/**
 * Atlas ATLAS-T1-REVISION-3-VERDICT-20261103 P2: transfer and teacher/change-password returned the raw
 * authentication exception text (an injected infrastructure marker, 500) on Preview. Every revised protected
 * freeze-entry handler is swept for the same catch pattern. Preview/staging return fixed codes; Production text is
 * unchanged (no repository-wide Production rewrite).
 */
describe("Preview authentication infrastructure failures never expose raw text", () => {
  const MARKER = "ATLAS_SYNTHETIC_AUTH_INFRASTRUCTURE_MARKER";
  it.each([
    ["platform/security/transfer", "POST"],
    ["teacher/change-password", "PATCH"],
  ])("RED (Atlas): %s %s returns a generic 500 on Preview", async (route, method) => {
    env("preview"); m.authFail.current = new Error(MARKER);
    const res = await call(route, method);
    expect(res.status).toBe(500);
    expect(res.text).not.toContain(MARKER);
    expect(res.json).toEqual({ error: "Internal error", code: "INTERNAL_ERROR" });
    expect(m.body).not.toHaveBeenCalled();
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each(PROTECTED)("RED (sweep): %s %s never returns the marker on Preview or staging", async (route, method) => {
    for (const vercelEnv of ["preview", "staging"]) {
      reset(); env(vercelEnv); m.authFail.current = new Error(MARKER);
      const res = await call(route, method);
      expect(res.text, `${vercelEnv} ${route}`).not.toContain(MARKER);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(m.body).not.toHaveBeenCalled();
    }
  });
  it.each([
    ["platform/security/transfer", "POST", null, 401, "UNAUTHORIZED"],
    ["platform/security/transfer", "POST", A.schoolAdmin, 403, "FORBIDDEN"],
    ["teacher/change-password", "PATCH", null, 401, "UNAUTHORIZED"],
    ["teacher/change-password", "PATCH", A.student, 403, "FORBIDDEN"],
  ] as const)("RED: Preview %s %s keeps status %#: fixed code", async (route, method, actor, status, code) => {
    env("preview"); m.actor.current = actor as Actor | null;
    const res = await call(route, method);
    expect([res.status, res.json?.code]).toEqual([status, code]);
  });
  it.each([
    ["platform/security/transfer", "POST"],
    ["teacher/change-password", "PATCH"],
  ])("Production %s %s error text is unchanged", async (route, method) => {
    env("production"); m.authFail.current = new Error(MARKER);
    const res = await call(route, method);
    expect(res.status).toBe(500);
    expect(res.json?.error).toBe(MARKER);
  });
});
