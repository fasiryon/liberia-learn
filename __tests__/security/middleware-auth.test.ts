import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import React from "react"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
}))

import { getToken } from "next-auth/jwt"
import { middleware } from "../../middleware"

const mockGetToken = vi.mocked(getToken)

function makeReq(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost"))
}

function locationOf(res: Response): string | null {
  return res.headers.get("location")
}

function isNext(res: Response): boolean {
  return locationOf(res) === null
}

describe("middleware auth - /admin and /platform portal guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. /admin with no token redirects to /login", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/admin"))
    expect(locationOf(res)).toContain("/login")
  })

  it("2. /admin with STUDENT token redirects to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "STUDENT", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/students"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("3. /admin with TEACHER token redirects to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/teachers"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("4. /admin with ADMIN token returns next", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/dashboard"))
    expect(isNext(res)).toBe(true)
  })

  it("5. /admin with isPlatformAdmin token returns next", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: true } as any)
    const res = await middleware(makeReq("/admin/settings"))
    expect(isNext(res)).toBe(true)
  })

  it("6. /platform with no token redirects to /login", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/platform"))
    expect(locationOf(res)).toContain("/login")
  })

  it("7. /platform with ADMIN token but not platform admin redirects to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/platform/users"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("8. /platform with isPlatformAdmin token returns next", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: true } as any)
    const res = await middleware(makeReq("/platform/users"))
    expect(isNext(res)).toBe(true)
  })

  it("9. /moe/dashboard with MOE_OFFICIAL token returns next", async () => {
    mockGetToken.mockResolvedValue({ role: "MOE_OFFICIAL", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/moe/dashboard"))
    expect(isNext(res)).toBe(true)
  })

  it("10. /moe/dashboard with ADMIN token redirects to role portal", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/moe/dashboard"))
    // ADMIN is redirected to roleDefaultPortal("ADMIN") = "/admin"
    const loc = locationOf(res)
    expect(loc).not.toBeNull()
    expect(loc).toContain("/admin")
  })

  it("11. /unauthorized page renders 'Access Denied' heading", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { default: UnauthorizedPage } = await import("../../app/unauthorized/page")
    const html = renderToStaticMarkup(React.createElement(UnauthorizedPage))
    expect(html).toContain("Access Denied")
  })

  it("12. Public routes /login and /privacy return next without getToken call", async () => {
    const loginRes = await middleware(makeReq("/login"))
    const privacyRes = await middleware(makeReq("/privacy"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(loginRes)).toBe(true)
    expect(isNext(privacyRes)).toBe(true)
  })

  it("13. /api/cron/* and /api/crons/* return next without getToken call", async () => {
    const cronRes = await middleware(makeReq("/api/cron/check-dlq"))
    const cronsRes = await middleware(makeReq("/api/crons/league-snapshot"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(cronRes)).toBe(true)
    expect(isNext(cronsRes)).toBe(true)
  })

  it("14. /enroll and /api/enroll return next without getToken call", async () => {
    const pageRes = await middleware(makeReq("/enroll"))
    const apiRes = await middleware(makeReq("/api/enroll"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(pageRes)).toBe(true)
    expect(isNext(apiRes)).toBe(true)
  })

  it("15. /onboard requires auth", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/onboard"))
    expect(locationOf(res)).toContain("/login")
  })

  it("16. /onboard/accept and /api/onboard/accept return next without getToken call", async () => {
    const pageRes = await middleware(makeReq("/onboard/accept"))
    const apiRes = await middleware(makeReq("/api/onboard/accept"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(pageRes)).toBe(true)
    expect(isNext(apiRes)).toBe(true)
  })

  it("17. /api/onboard/invite requires auth", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/api/onboard/invite"))
    expect(res.status).toBe(401)
  })

  it("18. /help and nested help pages return next without getToken call", async () => {
    const helpRes = await middleware(makeReq("/help"))
    const studentHelpRes = await middleware(makeReq("/help/student"))
    const guardianHelpRes = await middleware(makeReq("/help/guardian"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(helpRes)).toBe(true)
    expect(isNext(studentHelpRes)).toBe(true)
    expect(isNext(guardianHelpRes)).toBe(true)
  })
})

describe("middleware auth - /api/admin and /api/platform authentication backstop (NR-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("19. /api/admin/* with no token returns 401 JSON, not a redirect", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/api/admin/agents"))
    expect(res.status).toBe(401)
    expect(locationOf(res)).toBeNull()
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "Unauthorized" })
  })

  it("20. /api/platform/* with no token returns 401 JSON, not a redirect", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/api/platform/stats"))
    expect(res.status).toBe(401)
    expect(locationOf(res)).toBeNull()
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: "Unauthorized" })
  })

  it("21. /api/admin/* with any authenticated token (including non-ADMIN) passes through to the route", async () => {
    // Deliberately not ADMIN/platformAdmin: middleware must not role-gate
    // this namespace, since some routes legitimately allow other roles
    // (e.g. TEACHER approving a TEACHER-scoped item) and enforce the real
    // check themselves. See middleware.ts's isPortalApiRoute comment.
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/api/admin/ops/approvals/req-1/approve"))
    expect(isNext(res)).toBe(true)
  })

  it("22. /api/platform/* with any authenticated token passes through to the route", async () => {
    mockGetToken.mockResolvedValue({ role: "STUDENT", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/api/platform/stats"))
    expect(isNext(res)).toBe(true)
  })

  it("23. /api/admin/* backstop is checked before PUBLIC_PATHS, even if pathname collides with a public prefix", async () => {
    // /api/admin/canva/callback is not in PUBLIC_PATHS today, but this
    // guards the invariant regardless of future PUBLIC_PATHS edits: the
    // backstop check happens before isPublicPath is ever consulted.
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/api/admin/canva/callback"))
    expect(res.status).toBe(401)
  })
})
