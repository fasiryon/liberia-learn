import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getPipelineCostSummary } from "@/lib/curriculum/pipelineCostSummary";
import { isCostDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isCostDashboardEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await requireRole("ADMIN");
  const data = await getPipelineCostSummary();
  return NextResponse.json(data);
}
