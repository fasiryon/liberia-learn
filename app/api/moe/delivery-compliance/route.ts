// app/api/moe/delivery-compliance/route.ts
// Block 28 — MOE Delivery Compliance
// Returns lesson delivery compliance rates aggregated by district.
// No PII — district-level counts only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { getDeliveryComplianceByDistrict } from "@/lib/moe/deliveryCompliance";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { national, byDistrict } = await getDeliveryComplianceByDistrict();

    void logAudit({
      userId: user.id,
      action: "MOE_DELIVERY_COMPLIANCE_VIEW",
      resourceType: "delivery_compliance",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national,
      byDistrict,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
