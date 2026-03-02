/**
 * __tests__/moe.login.portal.test.ts
 *
 * Tests for the MOE Login Portal:
 *
 *  1. Route guard helper (lib/moe/routeGuard.ts) — pure functions
 *  2. Middleware /moe/* behaviour — using the exported middleware function
 *  3. Flag gate — isMoeLoginPortalEnabled
 *
 * Coverage per spec:
 *  - /moe/login page accessible only when flag is on
 *  - Successful login with MOE_OFFICIAL role admitted to /moe/dashboard
 *  - Successful login with non-MOE role (e.g. ADMIN) is rejected with correct error
 *  - /moe/dashboard redirects unauthenticated users to /moe/login
 *  - /moe/dashboard redirects non-MOE authenticated users to their portal
 *  - ENABLE_MOE_LOGIN_PORTAL flag off redirects /moe/login to /login
 *  - No school-level data accessible through /moe/* for non-MOE_OFFICIAL
 *    (enforced by middleware — verified by redirect behaviour)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

// ─── Import route guard helpers (pure functions, no mocks needed) ─────────────

import {
  isMoeAuthorized,
  roleDefaultPortal,
} from "@/lib/moe/routeGuard";

// ─── Import the actual middleware (uses mocked getToken via vi.mock above) ────

import { middleware } from "@/middleware";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

function getRedirectLocation(res: Response | undefined): string | null {
  return res?.headers.get("location") ?? null;
}

// ─── PART 1: Route guard helper tests (pure, no I/O) ─────────────────────────

describe("isMoeAuthorized — route guard helper", () => {
  it("returns false for null token (unauthenticated)", () => {
    expect(isMoeAuthorized(null)).toBe(false);
  });

  it("returns false for token with no role", () => {
    expect(isMoeAuthorized({})).toBe(false);
  });

  it("returns true for MOE_OFFICIAL role", () => {
    expect(isMoeAuthorized({ role: "MOE_OFFICIAL" })).toBe(true);
  });

  it("returns true for platform admin regardless of role", () => {
    expect(isMoeAuthorized({ role: "ADMIN", isPlatformAdmin: true })).toBe(true);
    expect(isMoeAuthorized({ isPlatformAdmin: true })).toBe(true);
  });

  it("returns false for ADMIN role (non-platform-admin)", () => {
    expect(isMoeAuthorized({ role: "ADMIN", isPlatformAdmin: false })).toBe(false);
  });

  it("returns false for TEACHER role", () => {
    expect(isMoeAuthorized({ role: "TEACHER" })).toBe(false);
  });

  it("returns false for STUDENT role", () => {
    expect(isMoeAuthorized({ role: "STUDENT" })).toBe(false);
  });

  it("returns false for GUARDIAN role", () => {
    expect(isMoeAuthorized({ role: "GUARDIAN" })).toBe(false);
  });

  it("returns false for DISTRICT_ADMIN role (non-platform-admin)", () => {
    expect(isMoeAuthorized({ role: "DISTRICT_ADMIN", isPlatformAdmin: false })).toBe(false);
  });
});

describe("roleDefaultPortal — portal routing helper", () => {
  it("routes ADMIN to /admin", () => {
    expect(roleDefaultPortal("ADMIN")).toBe("/admin");
  });

  it("routes DISTRICT_ADMIN to /admin", () => {
    expect(roleDefaultPortal("DISTRICT_ADMIN")).toBe("/admin");
  });

  it("routes TEACHER to /teacher", () => {
    expect(roleDefaultPortal("TEACHER")).toBe("/teacher");
  });

  it("routes GUARDIAN to /guardian", () => {
    expect(roleDefaultPortal("GUARDIAN")).toBe("/guardian");
  });

  it("routes STUDENT to /dashboard", () => {
    expect(roleDefaultPortal("STUDENT")).toBe("/dashboard");
  });

  it("routes MOE_OFFICIAL to /moe/dashboard", () => {
    expect(roleDefaultPortal("MOE_OFFICIAL")).toBe("/moe/dashboard");
  });

  it("routes unknown role to /login", () => {
    expect(roleDefaultPortal("UNKNOWN")).toBe("/login");
    expect(roleDefaultPortal(undefined)).toBe("/login");
  });
});

// ─── PART 2: Middleware /moe/* guard tests ────────────────────────────────────

describe("middleware — /moe/login flag gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects /moe/login to /login when ENABLE_MOE_LOGIN_PORTAL is off", async () => {
    process.env.ENABLE_MOE_LOGIN_PORTAL = "false";
    const res = await middleware(makeReq("/moe/login"));
    const location = getRedirectLocation(res);
    expect(location).toContain("/login");
    expect(location).not.toContain("/moe/login");
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
  });

  it("allows /moe/login when ENABLE_MOE_LOGIN_PORTAL is on", async () => {
    process.env.ENABLE_MOE_LOGIN_PORTAL = "true";
    const res = await middleware(makeReq("/moe/login"));
    // next() — no redirect, status is not 3xx
    expect(res?.status).not.toBeGreaterThanOrEqual(300);
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
  });

  it("ENABLE_MOE_LOGIN_PORTAL absent defaults to off (redirect)", async () => {
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
    const res = await middleware(makeReq("/moe/login"));
    expect(getRedirectLocation(res)).toContain("/login");
  });
});

describe("middleware — /moe/dashboard auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_MOE_LOGIN_PORTAL = "true";
  });

  afterEach(() => {
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
  });

  it("redirects unauthenticated request on /moe/dashboard to /moe/login", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await middleware(makeReq("/moe/dashboard"));
    const location = getRedirectLocation(res);
    expect(location).toContain("/moe/login");
  });

  it("redirects unauthenticated request on nested /moe/standards to /moe/login", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await middleware(makeReq("/moe/standards-coverage"));
    expect(getRedirectLocation(res)).toContain("/moe/login");
  });

  it("allows MOE_OFFICIAL user through /moe/dashboard", async () => {
    mockGetToken.mockResolvedValue({ role: "MOE_OFFICIAL", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/dashboard"));
    // next() — no redirect
    expect(res?.status).not.toBeGreaterThanOrEqual(300);
  });

  it("allows platform admin through /moe/dashboard", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: true });
    const res = await middleware(makeReq("/moe/dashboard"));
    expect(res?.status).not.toBeGreaterThanOrEqual(300);
  });

  it("redirects ADMIN (non-platform-admin) from /moe/dashboard to /admin", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/dashboard"));
    const location = getRedirectLocation(res);
    expect(location).toContain("/admin");
    expect(location).not.toContain("/moe");
  });

  it("redirects TEACHER from /moe/dashboard to /teacher", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/dashboard"));
    expect(getRedirectLocation(res)).toContain("/teacher");
  });

  it("redirects STUDENT from /moe/dashboard to /dashboard", async () => {
    mockGetToken.mockResolvedValue({ role: "STUDENT", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/dashboard"));
    expect(getRedirectLocation(res)).toContain("/dashboard");
  });

  it("redirects GUARDIAN from /moe/dashboard to /guardian", async () => {
    mockGetToken.mockResolvedValue({ role: "GUARDIAN", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/dashboard"));
    expect(getRedirectLocation(res)).toContain("/guardian");
  });

  it("non-MOE redirect prevents school-level PII exposure through /moe/*", async () => {
    // A non-MOE user hitting /moe/standards-coverage is redirected away — never reaches the route
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false });
    const res = await middleware(makeReq("/moe/standards-coverage"));
    // Confirm redirect — route handler never executes
    expect(res?.status).toBeGreaterThanOrEqual(300);
    expect(res?.status).toBeLessThan(400);
  });
});

// ─── PART 3: isMoeLoginPortalEnabled flag unit test ───────────────────────────

describe("isMoeLoginPortalEnabled serverFlag", () => {
  afterEach(() => {
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
  });

  it("returns false when env var is absent", async () => {
    delete process.env.ENABLE_MOE_LOGIN_PORTAL;
    // Re-import to pick up current process.env
    const { isMoeLoginPortalEnabled } = await import("@/lib/serverFlags");
    expect(isMoeLoginPortalEnabled()).toBe(false);
  });

  it("returns false when env var is 'false'", async () => {
    process.env.ENABLE_MOE_LOGIN_PORTAL = "false";
    const { isMoeLoginPortalEnabled } = await import("@/lib/serverFlags");
    expect(isMoeLoginPortalEnabled()).toBe(false);
  });

  it("returns true when env var is 'true'", async () => {
    process.env.ENABLE_MOE_LOGIN_PORTAL = "true";
    const { isMoeLoginPortalEnabled } = await import("@/lib/serverFlags");
    expect(isMoeLoginPortalEnabled()).toBe(true);
  });
});
