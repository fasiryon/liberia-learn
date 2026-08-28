// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isMoeAuthorized, roleDefaultPortal } from "@/lib/moe/routeGuard";
import {
  getStepUpCallbackUrl,
  hasRecentPrivilegedStepUp,
  isPrivilegedAccount,
  isPrivilegedMfaEnforced,
  isSensitivePrivilegedRequest,
} from "@/lib/auth/privilegedIdentity";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/enroll",
  "/api/enroll",
  "/onboard/accept",
  "/api/onboard/accept",
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
  "/help",
  "/offline",
  "/register",
  "/guardian/register",
  "/share/certificate",
  "/verify",
  "/api/certificates",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return false;
}

function privilegedStepUpResponse(req: NextRequest, token: Record<string, unknown>) {
  if (!isPrivilegedMfaEnforced()) return null;
  if (!isSensitivePrivilegedRequest(req.nextUrl.pathname, req.method)) return null;
  if (!isPrivilegedAccount(token as any)) return null;
  if (hasRecentPrivilegedStepUp(token as any)) return null;

  return NextResponse.json(
    {
      ok: false,
      error: "Step-up authentication required",
      code: "PRIVILEGED_STEP_UP_REQUIRED",
      stepUpUrl: getStepUpCallbackUrl(req.nextUrl.pathname, req.nextUrl.search),
    },
    { status: 428 }
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /moe/login is always public; the page renders portal availability inline.
  if (pathname === "/moe/login") {
    return NextResponse.next();
  }

  // /api/admin/* and /api/platform/* authentication backstop. This is
  // deliberately authentication-only, not role-gated: unlike the page
  // routes below, several of these API routes are legitimately callable by
  // non-ADMIN/non-platform-admin roles (e.g. a TEACHER approving a
  // TEACHER-scoped item via lib/autonomous/actions/approvalDecisionService.ts),
  // with the correct, sometimes record-scoped, authorization already
  // enforced inside each route/service. A blanket role gate here would
  // silently break those flows. Checked before isPublicPath below so a
  // future PUBLIC_PATHS edit can't accidentally exempt this namespace.
  if (pathname.startsWith("/api/admin/") || pathname.startsWith("/api/platform/")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const stepUpResponse = privilegedStepUpResponse(req, token as any);
    if (stepUpResponse) return stepUpResponse;
    return NextResponse.next();
  }

  // Protected portals. Single getToken call.
  // /moe/* requires MOE_OFFICIAL or isPlatformAdmin.
  // /admin/* requires ADMIN or isPlatformAdmin.
  // /platform/* requires isPlatformAdmin.
  const isPortalRoute =
    pathname.startsWith("/moe/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/platform" ||
    pathname.startsWith("/platform/");

  if (isPortalRoute) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (pathname.startsWith("/moe/")) {
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

    // /admin/* and /platform/* unauthenticated requests go to /login.
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if ((token as any).role !== "ADMIN" && !(token as any).isPlatformAdmin) {
        const url = req.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      if (!(token as any).isPlatformAdmin) {
        const url = req.nextUrl.clone();
        url.pathname = "/unauthorized";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
  }
  // Allow Next internals/static + health checks
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/screenshots/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/api/health") ||
    pathname === "/api/healthz"
  ) {
    return NextResponse.next();
  }

  // Cron routes authenticate themselves via a CRON_SECRET Bearer header, not
  // a NextAuth session - Vercel's scheduler (and any Bearer-token caller,
  // e.g. Ops Sentinel's retryCron) never carries a session cookie, so the
  // getToken() check below would 401 every invocation before it ever reaches
  // the route's own CRON_SECRET verification. Every route.ts under these two
  // prefixes independently checks CRON_SECRET - confirmed for all 24 routes
  // before adding this bypass.
  if (pathname.startsWith("/api/cron/") || pathname.startsWith("/api/crons/")) {
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

  const stepUpResponse = privilegedStepUpResponse(req, token as any);
  if (stepUpResponse) return stepUpResponse;

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
