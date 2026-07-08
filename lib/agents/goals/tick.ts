import { prisma } from "@/lib/db";
import { advanceGoal } from "@/lib/agents/goals/goalRunner";

/**
 * Scheduler heartbeat: advance every runnable goal by one step. Runnable =
 * fresh (OPEN), mid-flight (IN_PROGRESS), or a scheduled goal whose wake time
 * has arrived. Driven by a Vercel cron hitting the agent tick endpoint.
 */
export interface TickResult {
  scanned: number;
  advanced: number;
  failed: number;
  results: Array<{ goalId: string; ok: boolean; status?: string; error?: string }>;
}

export async function tickGoals(opts: { now?: Date; limit?: number } = {}): Promise<TickResult> {
  const now = opts.now ?? new Date();
  const runnable = await prisma.agentGoal.findMany({
    where: {
      OR: [
        { status: "OPEN" },
        { status: "IN_PROGRESS" },
        { status: "PAUSED_FOR_SCHEDULE", pauseUntil: { lte: now } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: opts.limit ?? 50,
    select: { id: true },
  });

  const results: TickResult["results"] = [];
  let advanced = 0;
  let failed = 0;
  for (const goal of runnable) {
    try {
      const r = await advanceGoal(goal.id, { now });
      if (r.advanced) advanced += 1;
      results.push({ goalId: goal.id, ok: true, status: r.status });
    } catch (e) {
      failed += 1;
      results.push({ goalId: goal.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { scanned: runnable.length, advanced, failed, results };
}
