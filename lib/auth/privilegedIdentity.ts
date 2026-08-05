export const AUTH0_MFA_ACR =
  "http://schemas.openid.net/pape/policies/2007/06/multi-factor";

export const PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "DISTRICT_ADMIN",
  "MOE_OFFICIAL",
  "MOE_SUPER_ADMIN",
  "MOE_DISTRICT_ADMIN",
]);

export type PrivilegedAssurance = {
  authProvider?: string | null;
  mfaVerifiedAt?: number | null;
  assuranceExpiresAt?: number | null;
  securityVersion?: number | null;
  privilegedSessionId?: string | null;
};

export type PrivilegedUserLike = PrivilegedAssurance & {
  role?: string | null;
  isPlatformAdmin?: boolean;
};

export function isPrivilegedAccount(user: PrivilegedUserLike): boolean {
  return user.isPlatformAdmin === true || PRIVILEGED_ROLES.has(user.role ?? "");
}

export function isPrivilegedMfaEnforced(): boolean {
  return process.env.PRIVILEGED_MFA_ENFORCEMENT_ENABLED?.trim().toLowerCase() === "true";
}

export function isAuth0Configured(): boolean {
  return Boolean(
    process.env.AUTH0_CLIENT_ID?.trim() &&
      process.env.AUTH0_CLIENT_SECRET?.trim() &&
      process.env.AUTH0_ISSUER?.trim()
  );
}

export function getAuth0Issuer(): string {
  return (process.env.AUTH0_ISSUER?.trim() ?? "").replace(/\/$/, "");
}

export function getStepUpMaxAgeSeconds(): number {
  const configured = Number.parseInt(process.env.PRIVILEGED_STEP_UP_MAX_AGE_SECONDS ?? "600", 10);
  if (!Number.isFinite(configured)) return 600;
  return Math.min(1800, Math.max(60, configured));
}

export function hasRecentPrivilegedStepUp(
  user: PrivilegedUserLike,
  nowMs = Date.now()
): boolean {
  if (!isPrivilegedAccount(user)) return false;
  if (user.authProvider !== "auth0" && user.authProvider !== "break-glass") return false;
  if (!user.mfaVerifiedAt || !user.assuranceExpiresAt) return false;

  const maxAgeMs = getStepUpMaxAgeSeconds() * 1000;
  return (
    user.mfaVerifiedAt <= nowMs &&
    nowMs - user.mfaVerifiedAt <= maxAgeMs &&
    user.assuranceExpiresAt > nowMs
  );
}

export function assertRecentPrivilegedStepUp(user: PrivilegedUserLike): void {
  if (!isPrivilegedMfaEnforced()) return;
  if (hasRecentPrivilegedStepUp(user)) return;

  throw Object.assign(new Error("Step-up authentication required"), {
    status: 428,
    code: "PRIVILEGED_STEP_UP_REQUIRED",
    stepUpUrl: "/auth/step-up",
  });
}

export function isSensitivePrivilegedRequest(pathname: string, method: string): boolean {
  const verb = method.toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(verb);

  if (
    pathname.startsWith("/api/admin/governance/exports/") ||
    pathname.startsWith("/api/admin/interoperability/") && pathname.includes("/export") ||
    pathname === "/api/admin/training/export" ||
    pathname.startsWith("/api/moe/export/")
  ) {
    return true;
  }

  if (
    pathname === "/api/admin/curriculum/approve" ||
    pathname === "/api/admin/curriculum/reject" ||
    pathname.startsWith("/api/admin/content-review/") && mutating ||
    pathname === "/api/moe/curriculum/publish" ||
    pathname.startsWith("/api/moe/submissions/") && pathname.endsWith("/review") ||
    pathname === "/api/moe/override"
  ) {
    return true;
  }

  if (!mutating) return false;

  return (
    pathname.startsWith("/api/platform/security/") ||
    pathname.startsWith("/api/platform/") ||
    pathname.startsWith("/api/admin/ops/") ||
    pathname === "/api/admin/curriculum/national-factory" ||
    pathname.startsWith("/api/moe/policies")
  );
}

export function getStepUpCallbackUrl(pathname: string, search = ""): string {
  const callback = `${pathname}${search}`;
  return `/auth/step-up?callbackUrl=${encodeURIComponent(callback)}`;
}
