import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isPredictionReviewWorkflowEnabled } from "@/lib/serverFlags";
import { assertPredictiveAccess, auditPredictiveRead, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { parseForecastRange } from "@/lib/autonomous/predictions/predictiveEvidenceService";
import { getPredictionReviewQueue, recordPredictionReview } from "@/lib/autonomous/predictions/predictionReviewService";

export const dynamic = "force-dynamic";

async function readBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return req.json();
  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

export async function GET(req: NextRequest) {
  try {
    if (!isPredictionReviewWorkflowEnabled()) return NextResponse.json({ error: "Prediction review workflow disabled" }, { status: 404 });
    const user = await requireUser();
    assertPredictiveAccess(user);
    const { searchParams } = new URL(req.url);
    const range = parseForecastRange({ from: searchParams.get("from"), to: searchParams.get("to") });
    const { scope } = forecastScopeForUser(user);
    await auditPredictiveRead({ user, route: "/api/admin/ops/prediction-reviews", scope });
    return NextResponse.json(await getPredictionReviewQueue({ scope, range }));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isPredictionReviewWorkflowEnabled()) return NextResponse.json({ error: "Prediction review workflow disabled" }, { status: 404 });
    const user = await requireUser();
    assertPredictiveAccess(user);
    const { scope } = forecastScopeForUser(user);
    const body = await readBody(req);
    const event = await recordPredictionReview({
      forecastId: String(body.forecastId ?? ""),
      forecastType: body.forecastType as any,
      decision: body.decision as any,
      schoolId: scope.aggregateSafe ? null : scope.schoolId ?? null,
      districtId: scope.districtId ?? null,
      actorId: user.id,
      confidenceScore: Number.isFinite(Number(body.confidenceScore)) ? Number(body.confidenceScore) : null,
      evidenceRefs: [],
      rationale: typeof body.rationale === "string" ? body.rationale : null,
    });
    return NextResponse.json({ ok: true, reviewEventId: (event as any)?.id ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
