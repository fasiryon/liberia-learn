import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const where = user.isPlatformAdmin
      ? {}
      : {
          schoolId: user.schoolId,
        };

    const [totals, grouped] = await Promise.all([
      (prisma as any).aiInteractionLog.aggregate({
        where,
        _sum: {
          tokensUsed: true,
          estimatedCostUSD: true,
        },
      }),
      (prisma as any).aiInteractionLog.groupBy({
        by: ["endpoint"],
        where,
        _sum: {
          tokensUsed: true,
          estimatedCostUSD: true,
        },
        _count: {
          endpoint: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalTokens: totals?._sum?.tokensUsed ?? 0,
      totalCost: totals?._sum?.estimatedCostUSD ?? 0,
      costPerEndpoint: grouped.map((entry: any) => ({
        endpoint: entry.endpoint ?? "unknown",
        totalTokens: entry?._sum?.tokensUsed ?? 0,
        totalCost: entry?._sum?.estimatedCostUSD ?? 0,
        requestCount: entry?._count?.endpoint ?? 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load AI cost summary" },
      { status: error?.status ?? 500 }
    );
  }
}
