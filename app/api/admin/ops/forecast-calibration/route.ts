import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isPredictionReviewWorkflowEnabled } from "@/lib/serverFlags";
import { assertPredictiveAccess, auditPredictiveRead, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";
import { getForecastCalibrationDashboard } from "@/lib/autonomous/predictions/forecastCalibrationDashboardService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isPredictionReviewWorkflowEnabled()) return NextResponse.json({ error: "Prediction review workflow disabled" }, { status: 404 });
    const user = await requireUser();
    assertPredictiveAccess(user);
    const { searchParams } = new URL(req.url);
    const range = parseForecastRange({ from: searchParams.get("from"), to: searchParams.get("to") });
    const { scope } = forecastScopeForUser(user);
    await auditPredictiveRead({ user, route: "/api/admin/ops/forecast-calibration", scope });
    return NextResponse.json(await getForecastCalibrationDashboard({ scope, range }));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
