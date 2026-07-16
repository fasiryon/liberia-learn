/**
 * lib/moe/deliveryCompliance.ts
 *
 * Extracted from app/api/moe/delivery-compliance/route.ts (Sprint 6.3) so the
 * moe-narrative-report agent's moereport.getScopeData tool can reuse the
 * exact same aggregation instead of duplicating it (per the sprint's Deliverable 2
 * instruction: call into existing MOE aggregation logic, don't reimplement it).
 * The route's behavior/response shape is unchanged - it now just calls
 * getDeliveryComplianceByDistrict() instead of inlining the query.
 */
import { prisma } from "@/lib/db";

export type DistrictCompliance = {
  districtId: string;
  districtName: string;
  region: string;
  schoolCount: number;
  studentCount: number;
  scheduledWorkTotal: number;
  scheduledWorkDelivered: number;
  compliancePct: number | null;
};

export type NationalDeliveryCompliance = {
  national: {
    scheduledWorkTotal: number;
    scheduledWorkDelivered: number;
    compliancePct: number | null;
  };
  byDistrict: DistrictCompliance[];
};

export async function getDeliveryComplianceByDistrict(): Promise<NationalDeliveryCompliance> {
  const districts = await prisma.district.findMany({
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

  const byDistrict: DistrictCompliance[] = districts.map((d) => {
    let total = 0;
    let delivered = 0;
    let studentCount = 0;
    for (const school of d.schools) {
      studentCount += school._count.users;
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
      studentCount,
      scheduledWorkTotal: total,
      scheduledWorkDelivered: delivered,
      compliancePct: total > 0 ? Math.round((delivered / total) * 10000) / 100 : null,
    };
  });

  const nationalTotal = byDistrict.reduce((s, d) => s + d.scheduledWorkTotal, 0);
  const nationalDelivered = byDistrict.reduce((s, d) => s + d.scheduledWorkDelivered, 0);

  return {
    national: {
      scheduledWorkTotal: nationalTotal,
      scheduledWorkDelivered: nationalDelivered,
      compliancePct:
        nationalTotal > 0 ? Math.round((nationalDelivered / nationalTotal) * 10000) / 100 : null,
    },
    byDistrict,
  };
}

export type SchoolCompliance = {
  schoolId: string;
  scheduledWorkTotal: number;
  scheduledWorkDelivered: number;
  compliancePct: number | null;
};

/** School-level delivery compliance - not covered by the existing district route, new for Sprint 6.3. */
export async function getDeliveryComplianceForSchool(schoolId: string): Promise<SchoolCompliance> {
  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { scheduledWork: { select: { id: true, isDelivered: true } } },
  });

  let total = 0;
  let delivered = 0;
  for (const cls of classes) {
    for (const sw of cls.scheduledWork) {
      total++;
      if (sw.isDelivered) delivered++;
    }
  }

  return {
    schoolId,
    scheduledWorkTotal: total,
    scheduledWorkDelivered: delivered,
    compliancePct: total > 0 ? Math.round((delivered / total) * 10000) / 100 : null,
  };
}
