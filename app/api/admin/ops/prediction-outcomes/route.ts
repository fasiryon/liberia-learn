import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPredictiveIntelligenceEnabled } from "@/lib/serverFlags";
import { assertPredictiveAccess, forecastScopeForUser } from "@/lib/autonomous/predictions/access";
import { recordForecastOutcome } from "@/lib/autonomous/predictions/forecastingTraceService";
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
    const events = await (prisma as any).learningEvent.findMany({
      where: {
        ...(scope.aggregateSafe ? {} : { schoolId: scope.schoolId }),
        eventType: "predictive.forecast.outcome_recorded",
        occurredAt: { gte: range.from, lte: range.to },
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
      select: { id: true, schoolId: true, districtId: true, eventType: true, status: true, occurredAt: true, metadata: true },
    });
    const safeEvents = events.map((event: any) => ({
      ...event,
      schoolId: scope.aggregateSafe ? null : event.schoolId,
      metadata: { ...(event.metadata ?? {}), notes: undefined },
    }));
    return NextResponse.json({
      outcomes: safeEvents,
      analytics: {
        total: safeEvents.length,
        accurate: safeEvents.filter((event: any) => event.metadata?.outcome === "accurate").length,
        falsePositive: safeEvents.filter((event: any) => event.metadata?.outcome === "false_positive").length,
        missedRisk: safeEvents.filter((event: any) => event.metadata?.outcome === "missed_risk").length,
        improvedAfterIntervention: safeEvents.filter((event: any) => event.metadata?.outcome === "improved_after_intervention").length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isPredictiveIntelligenceEnabled()) return NextResponse.json({ error: "Predictive intelligence disabled" }, { status: 404 });
    const user = await requireUser();
    assertPredictiveAccess(user);
    const { scope } = forecastScopeForUser(user);
    const contentType = req.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
    const result = await recordForecastOutcome({
      forecastId: String(body.forecastId ?? ""),
      forecastType: body.forecastType,
      outcome: body.outcome,
      schoolId: scope.aggregateSafe ? null : scope.schoolId ?? null,
      districtId: scope.districtId ?? null,
      actorId: user.id,
      evidenceRefs: Array.isArray(body.evidenceRefs) ? body.evidenceRefs : [],
      confidenceBefore: Number.isFinite(Number(body.confidenceBefore)) ? Number(body.confidenceBefore) : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ ok: true, confidenceAfter: result.confidenceAfter });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
