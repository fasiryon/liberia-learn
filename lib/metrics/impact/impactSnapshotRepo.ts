import { prisma } from "@/lib/db";
import type { ImpactSnapshot } from "@prisma/client";

export async function fetchLatestImpactSnapshot(params: {
  tenantId: string;
  schoolId: string;
}): Promise<ImpactSnapshot | null> {
  const { tenantId, schoolId } = params;
  return prisma.impactSnapshot.findFirst({
    where: {
      tenantId,
      schoolId,
    },
    orderBy: { generatedAt: "desc" },
  });
}
