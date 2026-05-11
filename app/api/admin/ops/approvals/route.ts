import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (user.role !== "TEACHER" && user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const where: any = { actionExecutionId: { not: null } };
    if (!user.isPlatformAdmin) where.schoolId = user.schoolId ?? "__none__";
    const approvals = await (prisma as any).approvalRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: 100,
    });
    return NextResponse.json(approvals);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load approvals" }, { status: error?.status ?? 500 });
  }
}
