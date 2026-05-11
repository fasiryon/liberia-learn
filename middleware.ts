// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isMoeAuthorized, roleDefaultPortal } from "@/lib/moe/routeGuard";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/onboard",
  "/api/onboard",
  "/api/onboard/school",
  "/api/auth",
  "/forgot-password",
  "/reset-password",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/canva/auth",
  "/api/canva/callback",
  "/pilot-preview",
  "/legal",
  "/privacy",
  "/terms",
  "/data-policy",
  "/contact",
  "/register",
  "/guardian/register",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /moe/login is always public; the page renders portal availability inline.
  if (pathname === "/moe/login") {
    return NextResponse.next();
  }

  // ── /moe/* — require auth AND MOE_OFFICIAL role ───────────────────────────
  if (pathname.startsWith("/moe/")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/moe/login";
      return NextResponse.redirect(url);
    }
    if (!isMoeAuthorized(token as any)) {
      const url = req.nextUrl.clone();
      url.pathname = roleDefaultPortal((token as any).role);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Let /admin and /platform pages render (rely on server-side auth in the page itself)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.next();
  }
  if (pathname === "/platform" || pathname.startsWith("/platform/")) {
    return NextResponse.next();
  }
  // Allow Next internals/static + health checks
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/api/health") ||
    pathname === "/api/healthz"
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Require auth for everything else
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    if (req.nextUrl.pathname.startsWith("/api/")) {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
    return NextResponse.redirect(url);
  }

  if (
    (token as any).role === "STUDENT" &&
    (token as any).mustChangePIN === true &&
    pathname !== "/student/change-pin" &&
    !pathname.startsWith("/api/student/change-pin")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/student/change-pin";
    return NextResponse.redirect(url);
  }

  if (
    (token as any).role === "TEACHER" &&
    (token as any).mustChangePIN === true &&
    pathname !== "/teacher/change-password" &&
    !pathname.startsWith("/api/teacher/change-password")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/teacher/change-password";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
