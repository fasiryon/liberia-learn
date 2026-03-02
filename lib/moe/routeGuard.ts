/**
 * lib/moe/routeGuard.ts
 *
 * Pure, testable helpers for the /moe/* middleware route guard.
 *
 * isMoeAuthorized — checks whether a JWT token grants MOE access
 * roleDefaultPortal — returns the default portal path for a given role
 */

export type MoeToken = {
  role?: string;
  isPlatformAdmin?: boolean;
} | null;

/**
 * Returns true when the token belongs to an MOE_OFFICIAL or a platform admin.
 * Both are allowed into /moe/* routes.
 */
export function isMoeAuthorized(token: MoeToken): boolean {
  if (!token) return false;
  return token.role === "MOE_OFFICIAL" || token.isPlatformAdmin === true;
}

/**
 * Returns the default portal path for a given role.
 * Used to redirect non-MOE authenticated users away from /moe/*.
 */
export function roleDefaultPortal(role: string | undefined): string {
  switch (role) {
    case "ADMIN":
    case "DISTRICT_ADMIN":
      return "/admin";
    case "TEACHER":
      return "/teacher";
    case "GUARDIAN":
      return "/guardian";
    case "STUDENT":
      return "/dashboard";
    case "MOE_OFFICIAL":
      return "/moe/dashboard";
    default:
      return "/login";
  }
}
