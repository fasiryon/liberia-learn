// app/api/moe/delivery-compliance/route.ts
// Block 28 — MOE Delivery Compliance
// Returns lesson delivery compliance rates aggregated by district.
// No PII — district-level counts only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const districts = await prisma.district.findMany({
      select: {
        id: true,
        name: true,
        region: true,
        schools: {
          select: {
            id: true,
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

    const byDistrict = districts.map((d) => {
      let total = 0;
      let delivered = 0;
      for (const school of d.schools) {
        for (const cls of school.classes) {
          for (const sw of cls.scheduledWork) {
            total++;
            if (sw.isDelivered) delivered++;
          }
        }
      }
      return {
        districtId: d.id,
        districtName: d.name,
        region: d.region,
        schoolCount: d.schools.length,
        scheduledWorkTotal: total,
        scheduledWorkDelivered: delivered,
        compliancePct: total > 0 ? Math.round((delivered / total) * 10000) / 100 : null,
      };
    });

    // National totals
    const nationalTotal = byDistrict.reduce((s, d) => s + d.scheduledWorkTotal, 0);
    const nationalDelivered = byDistrict.reduce((s, d) => s + d.scheduledWorkDelivered, 0);

    void logAudit({
      userId: user.id,
      action: "MOE_DELIVERY_COMPLIANCE_VIEW",
      resourceType: "delivery_compliance",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national: {
        scheduledWorkTotal: nationalTotal,
        scheduledWorkDelivered: nationalDelivered,
        compliancePct:
          nationalTotal > 0
            ? Math.round((nationalDelivered / nationalTotal) * 10000) / 100
            : null,
      },
      byDistrict,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
