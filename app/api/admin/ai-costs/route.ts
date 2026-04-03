import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { withRequestLogging } from "@/lib/logging/requestLogger";
import { logger } from "@/lib/logger";
import { getAiCostDashboardData } from "@/lib/ai/costSummary";

export const dynamic = "force-dynamic";

async function aiCostsGET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const data = await getAiCostDashboardData({
      schoolId: user.schoolId ?? null,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    logger.error("AI cost summary route failed", {
      route: "/api/admin/ai-costs",
      errorMessage: error?.message ?? "Failed to load AI cost summary",
      status: error?.status ?? 500,
    });
    return NextResponse.json(
      { error: error?.message ?? "Failed to load AI cost summary" },
      { status: error?.status ?? 500 }
    );
  }
}

export const GET = withRequestLogging("/api/admin/ai-costs", aiCostsGET);
