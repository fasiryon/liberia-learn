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

describe("middleware auth — /admin and /platform portal guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. /admin — no token → redirect to /login", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/admin"))
    expect(locationOf(res)).toContain("/login")
  })

  it("2. /admin — STUDENT token → redirect to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "STUDENT", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/students"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("3. /admin — TEACHER token → redirect to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/teachers"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("4. /admin — ADMIN token → next()", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/admin/dashboard"))
    expect(isNext(res)).toBe(true)
  })

  it("5. /admin — isPlatformAdmin token → next()", async () => {
    mockGetToken.mockResolvedValue({ role: "TEACHER", isPlatformAdmin: true } as any)
    const res = await middleware(makeReq("/admin/settings"))
    expect(isNext(res)).toBe(true)
  })

  it("6. /platform — no token → redirect to /login", async () => {
    mockGetToken.mockResolvedValue(null)
    const res = await middleware(makeReq("/platform"))
    expect(locationOf(res)).toContain("/login")
  })

  it("7. /platform — ADMIN token (not platform) → redirect to /unauthorized", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/platform/users"))
    expect(locationOf(res)).toContain("/unauthorized")
  })

  it("8. /platform — isPlatformAdmin token → next()", async () => {
    mockGetToken.mockResolvedValue({ role: "ADMIN", isPlatformAdmin: true } as any)
    const res = await middleware(makeReq("/platform/users"))
    expect(isNext(res)).toBe(true)
  })

  it("9. /moe/dashboard — MOE_OFFICIAL token → next() (regression)", async () => {
    mockGetToken.mockResolvedValue({ role: "MOE_OFFICIAL", isPlatformAdmin: false } as any)
    const res = await middleware(makeReq("/moe/dashboard"))
    expect(isNext(res)).toBe(true)
  })

  it("10. /moe/dashboard — ADMIN token → redirect to role portal (regression)", async () => {
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

  it("12. Public routes /login and /privacy → next() without getToken call", async () => {
    const loginRes = await middleware(makeReq("/login"))
    const privacyRes = await middleware(makeReq("/privacy"))
    expect(mockGetToken).not.toHaveBeenCalled()
    expect(isNext(loginRes)).toBe(true)
    expect(isNext(privacyRes)).toBe(true)
  })
})
