import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { districtScopeWhere, requireMoeActor } from "@/lib/moe/authority";
import { isMoePortalEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const { user, scope } = await requireMoeActor({ allowDistrict: true });
    const districts = await prisma.district.findMany({
      where: districtScopeWhere(scope),
      select: {
        id: true,
        name: true,
        region: true,
        schools: {
          where: scope.level === "national" ? undefined : { id: { in: scope.schoolIds } },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                users: { where: { role: "STUDENT" } },
                classes: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    await logAudit({
      userId: user.id,
      action: "moe.districts.view",
      resourceType: "district_directory",
      details: { scope: scope.level, districtId: scope.districtId },
    });

    return NextResponse.json({
      districts: districts.map((district) => ({
        id: district.id,
        name: district.name,
        region: district.region,
        schoolCount: district.schools.length,
        studentCount: district.schools.reduce((sum, school) => sum + school._count.users, 0),
        classCount: district.schools.reduce((sum, school) => sum + school._count.classes, 0),
        schools: district.schools,
      })),
    });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/districts", method: "GET" });
  }
}
