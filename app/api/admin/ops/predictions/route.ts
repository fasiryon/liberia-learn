import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isPredictiveIntelligenceEnabled } from "@/lib/serverFlags";
import { assertPredictiveAccess, auditPredictiveRead, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { getPredictiveIntelligence } from "@/lib/autonomous/predictions/predictiveIntelligenceService";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isPredictiveIntelligenceEnabled()) return NextResponse.json({ error: "Predictive intelligence disabled" }, { status: 404 });
    const user = await requireUser();
    assertPredictiveAccess(user);
    const { searchParams } = new URL(req.url);
    const range = parseForecastRange({ from: searchParams.get("from"), to: searchParams.get("to") });
    const { scope } = forecastScopeForUser(user);
    await auditPredictiveRead({ user, route: "/api/admin/ops/predictions", scope });
    const result = await getPredictiveIntelligence({ scope, range, targetId: searchParams.get("targetId") });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
