/** GET /api/admin/agents/goals — goal browser (filter by status, default OPEN+IN_PROGRESS+paused). */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { prisma } from "@/lib/db";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "PAUSED_FOR_HUMAN", "PAUSED_FOR_SCHEDULE"];

export async function GET(req: NextRequest) {
  try {
    await requireAgentAdmin();
    const status = new URL(req.url).searchParams.get("status");
    const where = status
      ? status === "all"
        ? {}
        : { status }
      : { status: { in: OPEN_STATUSES } };
    const goals = await prisma.agentGoal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ goals });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
