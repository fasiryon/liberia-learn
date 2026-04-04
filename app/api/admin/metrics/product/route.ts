import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  getProductMetricsDashboard,
  type ProductMetricsPeriod,
} from "@/lib/reporting/productMetrics";

export const dynamic = "force-dynamic";

function parsePeriod(value: string | null): ProductMetricsPeriod {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = parsePeriod(searchParams.get("period"));
    const requestedSchoolId = searchParams.get("schoolId");
    const effectiveSchoolId = user.isPlatformAdmin
      ? requestedSchoolId ?? user.schoolId ?? null
      : user.schoolId ?? null;

    if (!effectiveSchoolId && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const dashboard = await getProductMetricsDashboard({
      period,
      schoolId: effectiveSchoolId,
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "admin.product_metrics.viewed",
      resourceType: "product_metrics",
      traceId,
      details: {
        period,
        scope: dashboard.scope,
        schoolId: effectiveSchoolId,
      },
    });

    return NextResponse.json(dashboard);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
