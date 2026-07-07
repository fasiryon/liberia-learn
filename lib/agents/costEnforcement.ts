import { prisma } from "@/lib/db";
import { dayKeyUTC } from "@/lib/agents/costAccounting";
import type { AgentCostLimits } from "@/lib/agents/types";

/**
 * Pre-invocation cost enforcement. Checks the per-user daily cap and the
 * per-day total cap against accumulated spend BEFORE an agent runs. The
 * per-invocation cap is enforced inside the runtime loop as cost accrues.
 */
export interface CostCapResult {
  allowed: boolean;
  reason?: "user_daily_cap" | "day_total_cap";
}

export async function checkCostCaps(input: {
  agentName: string;
  userId?: string | null;
  costLimits: AgentCostLimits;
  at?: Date;
}): Promise<CostCapResult> {
  const at = input.at ?? new Date();
  const date = dayKeyUTC(at);
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

  // Per-day total across all users.
  const dayRow = await prisma.agentCostAccounting.findUnique({
    where: { agentName_date: { agentName: input.agentName, date } },
    select: { totalLlmCostUSD: true },
  });
  const dayTotal = dayRow?.totalLlmCostUSD ?? 0;
  if (dayTotal >= input.costLimits.perDayTotalUSD) {
    return { allowed: false, reason: "day_total_cap" };
  }

  // Per-user daily — only for user-triggered runs.
  if (input.userId) {
    const agg = await prisma.agentInvocation.aggregate({
      _sum: { llmCostUSD: true },
      where: {
        agentName: input.agentName,
        userId: input.userId,
        createdAt: { gte: date, lt: dayEnd },
      },
    });
    const userTotal = agg._sum.llmCostUSD ?? 0;
    if (userTotal >= input.costLimits.perUserPerDayUSD) {
      return { allowed: false, reason: "user_daily_cap" };
    }
  }

  return { allowed: true };
}
