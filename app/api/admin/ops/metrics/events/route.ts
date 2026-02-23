import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildMetricScopeWhere } from "@/lib/metrics/events";
import { resolveScopeParams } from "@/lib/reporting/scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const { scope, scopeId } = resolveScopeParams({
      scopeParam: searchParams.get("scope"),
      scopeIdParam: searchParams.get("scopeId"),
      user,
    });

    const parsedLimit = Number(searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 20;

    const events = await prisma.metricEvent.findMany({
      where: {
        pilotOnly: true,
        severity: { in: ["warning", "error"] },
        ...buildMetricScopeWhere(scope, scopeId),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        scope: true,
        scopeId: true,
        name: true,
        kind: true,
        severity: true,
        payloadJson: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: err?.status ?? 500 });
  }
}

