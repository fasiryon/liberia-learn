import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { getToken } from "next-auth/jwt";
import { middleware, portalRoleRedirect } from "../../middleware";

const mockGetToken = vi.mocked(getToken);
const req = (path: string) => new NextRequest(new URL(path, "http://localhost"));
const location = (res: Response) => res.headers.get("location");

describe("portal role gates (defense in depth)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["TEACHER", "/student/today", "/teacher"],
    ["GUARDIAN", "/student/lessons", "/guardian"],
    ["STUDENT", "/teacher/placements", "/dashboard"],
    ["GUARDIAN", "/teacher/student/stu-1", "/guardian"],
    ["STUDENT", "/guardian/progress", "/dashboard"],
    ["TEACHER", "/guardian/messages", "/teacher"],
    ["ADMIN", "/student/today", "/admin"],
    ["MOE_OFFICIAL", "/guardian", "/moe/dashboard"],
  ])("%s opening %s is sent to %s", async (role, path, target) => {
    mockGetToken.mockResolvedValue({ role, isPlatformAdmin: false } as any);
    const res = await middleware(req(path));
    expect(new URL(location(res)!).pathname).toBe(target);
  });

  it.each([
    ["STUDENT", "/student/today"],
    ["TEACHER", "/teacher/placements"],
    ["ADMIN", "/teacher/homework/hw-1"],
    ["GUARDIAN", "/guardian/progress"],
  ])("%s may open %s", async (role, path) => {
    mockGetToken.mockResolvedValue({ role, isPlatformAdmin: false } as any);
    const res = await middleware(req(path));
    expect(location(res)).toBeNull();
  });

  it("platform admins may open any portal", () => {
    expect(portalRoleRedirect("/student/today", { role: "ADMIN", isPlatformAdmin: true })).toBeNull();
    expect(portalRoleRedirect("/guardian", { role: "ADMIN", isPlatformAdmin: true })).toBeNull();
  });

  it("roles without a portal of their own go to /unauthorized, not /login", () => {
    expect(portalRoleRedirect("/student/today", { role: "MOE_SUPER_ADMIN" })).toBe("/unauthorized");
  });

  it("does not gate look-alike paths or the public guardian registration", async () => {
    expect(portalRoleRedirect("/students-info", { role: "GUARDIAN" })).toBeNull();
    mockGetToken.mockResolvedValue(null);
    const res = await middleware(req("/guardian/register"));
    expect(location(res)).toBeNull();
  });
});

describe("policy: no anonymous portfolio sharing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("portfolio share codes require a signed-in session", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await middleware(req("/api/portfolio/share-code-123"));
    expect(res.status).toBe(401);
  });
});

describe("policy: MOE live display stays authenticated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a display token does not open /moe/live without an MOE session", async () => {
    mockGetToken.mockResolvedValue(null);
    const res = await middleware(req("/moe/live?token=anything"));
    expect(new URL(location(res)!).pathname).toBe("/moe/login");
  });

  it("the live-token issuer is retired", async () => {
    const { GET } = await import("@/app/api/moe/live-token/route");
    const res = await GET();
    expect(res.status).toBe(410);
  });
});
