import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildGovernanceReport, type GovernanceReportPeriod } from "@/lib/governance/report";
import { isGovCircuitBreakerTripped } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function parsePeriod(value: string | null): GovernanceReportPeriod {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (isGovCircuitBreakerTripped()) {
      return NextResponse.json({ error: "governance_disabled" }, { status: 503 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "MOE_OFFICIAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = parsePeriod(searchParams.get("period"));
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolId = user.isPlatformAdmin ? requestedSchoolId ?? null : null;

    const report = await buildGovernanceReport({
      viewer: user,
      period,
      schoolId,
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "governance.report.viewed",
      resourceType: "governance_report",
      traceId,
      details: {
        period,
        schoolId,
        scope: report.scope,
      },
    });

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
