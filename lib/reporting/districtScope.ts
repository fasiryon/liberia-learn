import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function resolveDistrictContext(params: {
  user: SessionUser;
  searchParams: URLSearchParams;
}): Promise<{ districtId: string; tenantId: string }> {
  const { user, searchParams } = params;
  const requestedDistrictId = searchParams.get("districtId");

  if (user.isPlatformAdmin) {
    if (!requestedDistrictId) {
      throw Object.assign(new Error("districtId required"), { status: 400 });
    }
    const district = await prisma.district.findUnique({
      where: { id: requestedDistrictId },
      select: { id: true, tenantId: true },
    });
    if (!district) {
      throw Object.assign(new Error("district not found"), { status: 404 });
    }
    return { districtId: district.id, tenantId: district.tenantId };
  }

  if (!user.schoolId) {
    throw Object.assign(new Error("schoolId required"), { status: 400 });
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { districtId: true },
  });

  if (!school?.districtId) {
    throw Object.assign(new Error("district access not configured"), { status: 403 });
  }

  if (requestedDistrictId && requestedDistrictId !== school.districtId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const district = await prisma.district.findUnique({
    where: { id: school.districtId },
    select: { id: true, tenantId: true },
  });
  if (!district) {
    throw Object.assign(new Error("district not found"), { status: 404 });
  }

  return { districtId: district.id, tenantId: district.tenantId };
}
