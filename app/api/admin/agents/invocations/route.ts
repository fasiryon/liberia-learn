/**
 * GET /api/admin/agents/invocations
 *
 * Paginated agent invocation log with filters. Admin / platform-admin only.
 *
 * Query params:
 *   agentName - exact match
 *   status    - exact match (SUCCESS|FAILURE|ESCALATED|TIMEOUT|COST_CAPPED|FEATURE_DISABLED)
 *   userId    - exact match
 *   from      - ISO date (inclusive)
 *   to        - ISO date (inclusive)
 *   page      - 1-indexed (default 1)
 *
 * Returns { total, page, pageSize, pages, invocations[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    assertPermission(user, PERMISSIONS.AGENT_PLATFORM_VIEW);

    const { searchParams } = new URL(req.url);
    const agentName = searchParams.get("agentName") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const createdAt: Record<string, Date> = {};
    if (fromParam && !Number.isNaN(Date.parse(fromParam))) createdAt.gte = new Date(fromParam);
    if (toParam && !Number.isNaN(Date.parse(toParam))) createdAt.lte = new Date(toParam);

    const where: Record<string, unknown> = {
      ...(agentName ? { agentName } : {}),
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const [total, invocations] = await Promise.all([
      prisma.agentInvocation.count({ where }),
      prisma.agentInvocation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      invocations,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: "request_failed" }, { status });
  }
}
