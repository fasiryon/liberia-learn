import { prisma } from "@/lib/db";
import { roundUSD } from "@/lib/agents/money";

/**
 * Per-agent, per-day cost accounting. Cost is tracked to at least 4 decimal
 * places USD (we round to 6dp to keep float accumulation clean). uniqueUsers is
 * recomputed from the day's distinct invocation users so it stays accurate
 * rather than drifting via naive increment.
 */

export { roundUSD };

/** Truncate a timestamp to UTC midnight (the accounting bucket key). */
export function dayKeyUTC(at: Date = new Date()): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
  );
}

export interface RecordSpendInput {
  agentName: string;
  llmCostUSD: number;
  toolCostUnits: number;
  at?: Date;
}

export async function recordSpend(input: RecordSpendInput): Promise<void> {
  const at = input.at ?? new Date();
  const date = dayKeyUTC(at);
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const cost = roundUSD(input.llmCostUSD);
  const toolUnits = input.toolCostUnits;

  const distinctUsers = await prisma.agentInvocation.findMany({
    where: {
      agentName: input.agentName,
      createdAt: { gte: date, lt: dayEnd },
      userId: { not: null },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  const uniqueUsers = distinctUsers.length;

  await prisma.agentCostAccounting.upsert({
    where: { agentName_date: { agentName: input.agentName, date } },
    create: {
      agentName: input.agentName,
      date,
      totalInvocations: 1,
      totalLlmCostUSD: cost,
      totalToolCostUnits: toolUnits,
      uniqueUsers,
    },
    update: {
      totalInvocations: { increment: 1 },
      totalLlmCostUSD: { increment: cost },
      totalToolCostUnits: { increment: toolUnits },
      uniqueUsers,
    },
  });
}
