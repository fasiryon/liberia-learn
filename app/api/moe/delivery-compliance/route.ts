import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isMoeDistrictRole, isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const isNational = user.isPlatformAdmin || isMoeSuperRole(user.role);
    if (!isNational && !isMoeDistrictRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const districtId =
      !isNational && user.schoolId
        ? (await prisma.school.findUnique({ where: { id: user.schoolId }, select: { districtId: true } }))?.districtId ?? null
        : null;

    const districts = await prisma.district.findMany({
      where: districtId ? { id: districtId } : {},
      select: {
        id: true,
        name: true,
        region: true,
        schools: {
          select: {
            id: true,
            _count: { select: { users: { where: { role: "STUDENT" } } } },
            classes: {
              select: {
                scheduledWork: {
                  select: { id: true, isDelivered: true },
                },
              },
            },
          },
        },
      },
    });

    const byDistrict = districts.map((district) => {
      let total = 0;
      let delivered = 0;
      let studentCount = 0;
      for (const school of district.schools) {
        studentCount += school._count.users;
        for (const cls of school.classes) {
          for (const work of cls.scheduledWork) {
            total += 1;
            if (work.isDelivered) delivered += 1;
          }
        }
      }

      return {
        districtId: district.id,
        districtName: district.name,
        region: district.region,
        schoolCount: district.schools.length,
        studentCount,
        scheduledWorkTotal: total,
        scheduledWorkDelivered: delivered,
        compliancePct: total > 0 ? Math.round((delivered / total) * 10000) / 100 : null,
      };
    });

    const nationalTotal = byDistrict.reduce((sum, district) => sum + district.scheduledWorkTotal, 0);
    const nationalDelivered = byDistrict.reduce((sum, district) => sum + district.scheduledWorkDelivered, 0);

    await logAudit({
      userId: user.id,
      action: "MOE_DELIVERY_COMPLIANCE_VIEW",
      resourceType: "delivery_compliance",
      details: { scope: isNational ? "national" : "district", districtId },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national: {
        scheduledWorkTotal: nationalTotal,
        scheduledWorkDelivered: nationalDelivered,
        compliancePct: nationalTotal > 0 ? Math.round((nationalDelivered / nationalTotal) * 10000) / 100 : null,
      },
      byDistrict,
    });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/delivery-compliance", method: "GET" });
  }
}
