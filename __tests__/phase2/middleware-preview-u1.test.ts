/**
 * Phase 2 (integration/g4-day) interaction: U1 claims-only middleware (main) × V3 Preview concealment and cron refusal.
 *  - a disabled learning preview is concealed (404, no-store, Vary: Cookie) BEFORE any token read, even with a legacy
 *    cookie, so concealment does not reveal session state;
 *  - with the preview enabled, U1 still refuses a legacy/invalid token there (redirect to sign-in, cookie cleared) and
 *    admits a current one with the admitted marker;
 *  - on a deployed Preview, cron calls are refused before any token read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { middleware } from "../../middleware";

const NOW = Date.now();
const req = (path: string) => new NextRequest(new URL(path, "http://localhost"), { headers: { cookie: "next-auth.session-token=signed.jwt.value" } });
const legacy = { id: "stu-1", role: "STUDENT", isPlatformAdmin: false };
const current = { ...legacy, authTime: NOW - 60_000, credStamp: 0 };
const clearsCookie = (res: Response) => /next-auth\.session-token=;/.test(res.headers.get("set-cookie") ?? "");

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());

describe("disabled learning preview: concealed before any token read", () => {
  it.each(["/learn/day", "/learn/preview/x", "/api/student/learning-preview/x"])("%s → 404 with a legacy cookie, token never read", async (path) => {
    vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "");
    getToken.mockResolvedValue(legacy);
    const res = await middleware(req(path));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("enabled learning preview: U1 still decides admission", () => {
  beforeEach(() => vi.stubEnv("V4_LEARNING_PREVIEW_ENABLED", "1"));
  it("a legacy token is refused (sign-in redirect) and its cookie cleared", async () => {
    getToken.mockResolvedValue(legacy);
    const res = await middleware(req("/learn/day"));
    expect(res.headers.get("location")).toContain("/login");
    expect(clearsCookie(res)).toBe(true);
  });
  it("a current token is admitted with the admitted marker", async () => {
    getToken.mockResolvedValue(current);
    const res = await middleware(req("/learn/day"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-ll-session-admitted")).toBe("1");
  });
});

describe("deployed Preview: cron refused before any token read", () => {
  it("/api/cron/x → 401, token never read", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await middleware(req("/api/cron/check-dlq"));
    expect(res.status).toBe(401);
    expect(getToken).not.toHaveBeenCalled();
  });
});
