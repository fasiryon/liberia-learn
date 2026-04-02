import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resolveScopeParams } from "@/lib/reporting/scope";
import { aggregateMetrics } from "@/lib/metrics/events";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function metricsSummaryGET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const { scope, scopeId } = resolveScopeParams({
      scopeParam: searchParams.get("scope"),
      scopeIdParam: searchParams.get("scopeId"),
      user,
    });
    const rangeParam = (searchParams.get("range") ?? "7d") as "7d" | "30d";
    const summary = await aggregateMetrics({ scope, scopeId, range: rangeParam });
    return NextResponse.json(summary);
  } catch (err: any) {
    logger.error("Ops metrics summary route failed", {
      route: "/api/admin/ops/metrics/summary",
      errorMessage: err?.message ?? "Failed",
      status: err?.status ?? 500,
    });
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

export const GET = withRequestLogging("/api/admin/ops/metrics/summary", metricsSummaryGET);

