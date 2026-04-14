const MOE_SUPER_ROLE_SET = new Set(["MOE_SUPER_ADMIN", "MOE_OFFICIAL"]);
const MOE_DISTRICT_ROLE_SET = new Set(["MOE_DISTRICT_ADMIN", "DISTRICT_ADMIN"]);

export function isMoeSuperRole(role?: string | null): boolean {
  return MOE_SUPER_ROLE_SET.has(role ?? "");
}

export function isMoeDistrictRole(role?: string | null): boolean {
  return MOE_DISTRICT_ROLE_SET.has(role ?? "");
}

export function isAnyMoeRole(role?: string | null): boolean {
  return isMoeSuperRole(role) || isMoeDistrictRole(role);
}

export function roleMatches(actualRole: string | null | undefined, allowedRoles: string[]): boolean {
  const actual = actualRole ?? "";
  if (allowedRoles.includes(actual)) {
    return true;
  }

  return allowedRoles.some((allowedRole) => {
    if (allowedRole === "MOE_SUPER_ADMIN" || allowedRole === "MOE_OFFICIAL") {
      return isMoeSuperRole(actual);
    }
    if (allowedRole === "MOE_DISTRICT_ADMIN" || allowedRole === "DISTRICT_ADMIN") {
      return isMoeDistrictRole(actual);
    }
    return false;
  });
}
