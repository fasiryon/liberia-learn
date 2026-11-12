// route-policy: auth=session; scope=platform; authority=platform-admin; rationale=global content and cost operations require a canonical platform ADMIN before domain work
import { NextResponse } from "next/server";
import { requirePlatformContentAdmin } from "@/lib/auth/platformContentAuthority";
import { getPipelineCostSummary } from "@/lib/curriculum/pipelineCostSummary";
import { isCostDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePlatformContentAdmin();
    if (!isCostDashboardEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = await getPipelineCostSummary();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: status >= 500 ? "Cost summary unavailable" : "Forbidden" }, { status });
  }
}
