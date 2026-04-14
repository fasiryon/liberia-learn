import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isAnyMoeRole, isMoeDistrictRole, isMoeSuperRole } from "@/lib/moe/rbac";

export type MoeScope =
  | {
      level: "national";
      districtId: null;
      districtName: null;
      schoolIds: null;
    }
  | {
      level: "district";
      districtId: string;
      districtName: string | null;
      schoolIds: string[];
    };

export async function resolveMoeScope(user: SessionUser): Promise<MoeScope> {
  if (user.isPlatformAdmin || isMoeSuperRole(user.role)) {
    return {
      level: "national",
      districtId: null,
      districtName: null,
      schoolIds: null,
    };
  }

  if (!isMoeDistrictRole(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  if (!user.schoolId) {
    throw Object.assign(new Error("District-scoped MOE user is missing school context"), { status: 403 });
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: {
      districtId: true,
      District: { select: { id: true, name: true } },
    },
  });

  const districtId = school?.districtId ?? school?.District?.id ?? null;
  if (!districtId) {
    throw Object.assign(new Error("District scope unavailable for current user"), { status: 403 });
  }

  const schools = await prisma.school.findMany({
    where: { districtId },
    select: { id: true },
  });

  return {
    level: "district",
    districtId,
    districtName: school?.District?.name ?? null,
    schoolIds: schools.map((item) => item.id),
  };
}

export async function requireMoeActor(options?: { allowDistrict?: boolean }) {
  const user = await requireUser();
  if (!user.isPlatformAdmin && !isAnyMoeRole(user.role)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  if (!options?.allowDistrict) {
    assertPermission(user, PERMISSIONS.MOE_ACCESS_NATIONAL);
  } else {
    assertPermission(
      user,
      isMoeDistrictRole(user.role) ? PERMISSIONS.MOE_ACCESS_DISTRICT : PERMISSIONS.MOE_ACCESS_NATIONAL
    );
  }

  const scope = await resolveMoeScope(user);
  if (!options?.allowDistrict && scope.level !== "national") {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  return { user, scope };
}

export function schoolScopeWhere(scope: MoeScope) {
  if (scope.level === "national") {
    return {};
  }

  return { id: { in: scope.schoolIds } };
}

export function districtScopeWhere(scope: MoeScope) {
  if (scope.level === "national") {
    return {};
  }

  return { id: scope.districtId };
}
