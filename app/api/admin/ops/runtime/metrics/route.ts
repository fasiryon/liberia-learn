import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getRuntimeMetrics } from "@/lib/autonomous/runtime/runtimeMetricsService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const windowHours = Math.min(168, Math.max(1, Number(req.nextUrl.searchParams.get("hours") ?? "24")));
    const metrics = await getRuntimeMetrics({ windowHours });
    return NextResponse.json({ ok: true, metrics });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load runtime metrics" }, { status: error?.status ?? 500 });
  }
}
