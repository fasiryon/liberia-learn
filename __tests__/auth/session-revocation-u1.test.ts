/**
 * U1 (founder-authorized 2026-11-05): a validly SIGNED but revoked, legacy or expired JWT must not reach protected data.
 *
 * Exposure demonstrated on 8574c05e:
 *  - middleware admits any signed token (getToken checks signature and exp only), including one with no credStamp or
 *    authTime and one past its role's absolute lifetime;
 *  - /api/league, /api/league/district and /api/league/district/summary serve data on middleware admission alone
 *    (no server session call), so a revoked session still reads them;
 *  - portal layouts render the portal shell for a token that middleware admitted but the server refused.
 *
 * Contract:
 *  - middleware (Edge, claims only, no database) refuses a token that lacks a string id or a numeric authTime/credStamp,
 *    or whose authTime is past 30 d (ordinary) / 8 h (privileged); it clears the session cookie, and it marks every
 *    request it admitted on a token with `x-ll-session-admitted: 1` (an inbound value is always stripped);
 *  - server pages under an admitted request redirect to sign-in when the authoritative server session is null
 *    (revoked, disabled, changed, or the database failed), so they never render for such a session;
 *  - the league routes run the authoritative server check and are never shared-cached.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  headersGet: vi.fn(),
  redirect: vi.fn((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url}` }); }),
  requireUser: vi.fn(),
  leagueFindMany: vi.fn(),
  computeSchoolWeeklyScores: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("next/headers", () => ({ headers: () => ({ get: mocks.headersGet }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({
  prisma: {
    leagueSnapshot: { findMany: mocks.leagueFindMany },
    school: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/flags", () => ({ isLeagueTableFlagEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/cache/redisCache", () => ({
  FALLBACK_LIMIT_EXCEEDED: Symbol("fallback"),
  withRedisCache: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
}));
vi.mock("@/lib/league/weeklyScore", () => ({
  currentWeekWindow: () => ({ weekStart: new Date("2026-11-02T00:00:00Z"), weekEnd: new Date("2026-11-09T00:00:00Z") }),
  computeSchoolWeeklyScores: mocks.computeSchoolWeeklyScores,
  assignDistrictRanks: (s: unknown[]) => s,
}));

import { middleware } from "../../middleware";
import { SESSION_ADMITTED_HEADER, sessionClaimsFailure } from "@/lib/auth/sessionClaims";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const token = (over: Record<string, unknown> = {}) => ({ id: "u1", role: "STUDENT", isPlatformAdmin: false, authTime: now - HOUR, credStamp: 0, ...over });
const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "http://localhost"), { headers: { cookie: "next-auth.session-token=signed.jwt.value", ...headers } });
const admitted = (res: Response) => res.headers.get(`x-middleware-request-${SESSION_ADMITTED_HEADER}`);
const clearsSessionCookie = (res: Response) => /next-auth\.session-token=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(res.headers.get("set-cookie") ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headersGet.mockReturnValue(null);
});

describe("sessionClaimsFailure (Edge-safe, no database)", () => {
  it("accepts a current ordinary and a current privileged token", () => {
    expect(sessionClaimsFailure(token(), now)).toBeNull();
    expect(sessionClaimsFailure(token({ role: "MOE_OFFICIAL", authTime: now - 7 * HOUR }), now)).toBeNull();
  });
  it.each([
    ["no id", { id: undefined }, "SESSION_IDENTITY_MISSING"],
    ["no authTime (legacy token)", { authTime: undefined }, "SESSION_AUTH_TIME_INVALID"],
    ["string authTime", { authTime: String(now) }, "SESSION_AUTH_TIME_INVALID"],
    ["authTime far in the future", { authTime: now + HOUR }, "SESSION_AUTH_TIME_INVALID"],
    ["no credStamp (legacy token)", { credStamp: undefined }, "SESSION_CREDENTIAL_STAMP_INVALID"],
    ["negative credStamp", { credStamp: -1 }, "SESSION_CREDENTIAL_STAMP_INVALID"],
    ["ordinary past 30 days", { authTime: now - 30 * DAY - 1000 }, "SESSION_LIFETIME_EXCEEDED"],
    ["privileged role past 8 hours", { role: "ADMIN", authTime: now - 8 * HOUR - 1000 }, "SESSION_LIFETIME_EXCEEDED"],
    ["platform admin past 8 hours", { role: "TEACHER", isPlatformAdmin: true, authTime: now - 9 * HOUR }, "SESSION_LIFETIME_EXCEEDED"],
  ])("refuses %s", (_label, over, code) => {
    expect(sessionClaimsFailure(token(over), now)).toBe(code);
  });
});

describe("middleware: claims-only refusal of signed tokens", () => {
  it("refuses a legacy token (no credStamp/authTime) on a portal page: redirect to /login and clear the cookie", async () => {
    mocks.getToken.mockResolvedValue({ id: "u1", role: "STUDENT", isPlatformAdmin: false });
    const res = await middleware(req("/student/dashboard"));
    expect(res.headers.get("location")).toContain("/login");
    expect(clearsSessionCookie(res)).toBe(true);
    expect(admitted(res)).toBeNull();
  });

  it("refuses an expired ordinary token on a protected API with 401", async () => {
    mocks.getToken.mockResolvedValue(token({ authTime: now - 31 * DAY }));
    const res = await middleware(req("/api/student/today"));
    expect(res.status).toBe(401);
    expect(clearsSessionCookie(res)).toBe(true);
  });

  it("refuses a privileged token past 8 hours on /api/admin and /api/platform", async () => {
    mocks.getToken.mockResolvedValue(token({ role: "ADMIN", authTime: now - 9 * HOUR }));
    expect((await middleware(req("/api/admin/teachers"))).status).toBe(401);
    mocks.getToken.mockResolvedValue(token({ role: "TEACHER", isPlatformAdmin: true, authTime: now - 9 * HOUR }));
    expect((await middleware(req("/api/platform/security/sessions/revoke"))).status).toBe(401);
  });

  it("refuses a legacy token on /admin, /platform and /moe pages", async () => {
    mocks.getToken.mockResolvedValue({ id: "a", role: "ADMIN", isPlatformAdmin: true });
    expect((await middleware(req("/admin/teachers"))).headers.get("location")).toContain("/login");
    expect((await middleware(req("/platform/security"))).headers.get("location")).toContain("/login");
    expect((await middleware(req("/moe/dashboard"))).headers.get("location")).toContain("/moe/login");
  });

  it("refuses a malformed cookie (getToken throws on 4.24.14, returns null on 4.24.15) instead of erroring", async () => {
    mocks.getToken.mockRejectedValue(new URIError("URI malformed"));
    const page = await middleware(req("/student/dashboard"));
    expect(page.headers.get("location")).toContain("/login");
    expect(clearsSessionCookie(page)).toBe(true);
    const api = await middleware(req("/api/admin/teachers"));
    expect(api.status).toBe(401);
    mocks.getToken.mockResolvedValue(null);
    expect((await middleware(req("/api/student/today"))).status).toBe(401);
  });

  it("admits a current token and marks the request as admitted", async () => {
    mocks.getToken.mockResolvedValue(token());
    const res = await middleware(req("/student/dashboard"));
    expect(res.headers.get("location")).toBeNull();
    expect(admitted(res)).toBe("1");
    mocks.getToken.mockResolvedValue(token({ role: "ADMIN" }));
    expect(admitted(await middleware(req("/admin/teachers")))).toBe("1");
    expect(admitted(await middleware(req("/api/admin/teachers")))).toBe("1");
  });

  it("public paths stay public with a bad token, and an inbound admitted header is stripped", async () => {
    mocks.getToken.mockResolvedValue({ id: "u1" });
    const res = await middleware(req("/login", { [SESSION_ADMITTED_HEADER]: "1" }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
    expect(admitted(res)).not.toBe("1");
    expect(mocks.getToken).not.toHaveBeenCalled();
    const reg = await middleware(req("/guardian/register", { [SESSION_ADMITTED_HEADER]: "1" }));
    expect(admitted(reg)).not.toBe("1");
  });
});

describe("server pages under an admitted request", () => {
  it("redirects to sign-in when middleware admitted a token but the server session is null (revoked or DB failure)", async () => {
    const { enforceAdmittedSession } = await import("@/lib/auth/admittedSession");
    mocks.headersGet.mockImplementation((name: string) => (name === SESSION_ADMITTED_HEADER ? "1" : null));
    expect(() => enforceAdmittedSession(null)).toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?reason=session_ended");
    expect(() => enforceAdmittedSession(null, "/moe/login?reason=session_ended")).toThrow("NEXT_REDIRECT");
  });

  it("does not redirect a public (not admitted) request or a current session", async () => {
    const { enforceAdmittedSession } = await import("@/lib/auth/admittedSession");
    expect(() => enforceAdmittedSession(null)).not.toThrow();
    mocks.headersGet.mockImplementation((name: string) => (name === SESSION_ADMITTED_HEADER ? "1" : null));
    expect(() => enforceAdmittedSession({ id: "u1" })).not.toThrow();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("league routes run the authoritative server check", () => {
  const revoked = () => mocks.requireUser.mockRejectedValue(Object.assign(new Error("Session expired"), { status: 401 }));

  it.each([
    ["/api/league", () => import("@/app/api/league/route"), "http://localhost/api/league"],
    ["/api/league/district", () => import("@/app/api/league/district/route"), "http://localhost/api/league/district?district=Monrovia"],
    ["/api/league/district/summary", () => import("@/app/api/league/district/summary/route"), "http://localhost/api/league/district/summary"],
  ])("%s refuses a revoked session before reading any data", async (_p, load, url) => {
    revoked();
    const { GET } = await load();
    const res = await (GET as (r: NextRequest) => Promise<Response>)(new NextRequest(url));
    expect(res.status).toBe(401);
    expect(mocks.leagueFindMany).not.toHaveBeenCalled();
    expect(mocks.computeSchoolWeeklyScores).not.toHaveBeenCalled();
  });

  it("a database failure in the server check is not served as data (fails closed)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const { GET } = await import("@/app/api/league/district/route");
    const res = await GET(new NextRequest("http://localhost/api/league/district?district=Monrovia"));
    expect(res.status).toBe(500);
    expect(mocks.computeSchoolWeeklyScores).not.toHaveBeenCalled();
  });

  it("a current session is served and never shared-cached", async () => {
    mocks.requireUser.mockResolvedValue({ id: "u1", role: "STUDENT" });
    mocks.leagueFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/league/route");
    const res = await GET(new NextRequest("http://localhost/api/league"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control") ?? "").not.toMatch(/public|s-maxage/);
  });
});
