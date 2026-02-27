import { requirePlatformAdmin, requireRole, type SessionUser } from "@/lib/auth";
import { getMoePortalAllowlist, isMoePortalEnabled } from "@/lib/serverFlags";

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function isAllowlistedEmail(email: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return allowlist.some((entry) => {
    const item = entry.trim().toLowerCase();
    if (!item) return false;
    if (item.includes("@")) {
      return normalized === item;
    }
    const domain = item.startsWith("@") ? item.slice(1) : item;
    return normalized.endsWith(`@${domain}`);
  });
}

/** Throws 404 when MOE portal flag is off, 403 when user is not allowed. */
export async function requireMoePortalUser(): Promise<SessionUser> {
  if (!isMoePortalEnabled()) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const user = await requireRole("ADMIN", "DISTRICT_ADMIN");

  if (user.role === "ADMIN" && !user.isPlatformAdmin) {
    throw Object.assign(new Error("Forbidden — platform admin required"), { status: 403 });
  }

  const allowlist = getMoePortalAllowlist();
  if (!isAllowlistedEmail(user.email ?? null, allowlist)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  return user;
}

/** Platform-admin-only access with MOE portal flag + allowlist. */
export async function requireMoePlatformAdmin(): Promise<SessionUser> {
  if (!isMoePortalEnabled()) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }

  const user = await requirePlatformAdmin();
  const allowlist = getMoePortalAllowlist();
  if (!isAllowlistedEmail(user.email ?? null, allowlist)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return user;
}
