import { runAgent, type RunContext } from "@/lib/agents/runtime";
import { isAgentEnabled } from "@/lib/agents/flags";

/**
 * Code-based schedule registry. A schedule binds an agent to a cron cadence and
 * a contextBuilder that yields the inputs for that run (e.g. one per guardian
 * with unread progress). The cron cadence itself is driven by a Vercel cron
 * entry that calls the agent tick endpoint; the `cron` field documents intent.
 */
export interface ScheduledContext {
  input: string;
  ctx?: RunContext;
}

export interface ScheduleDefinition {
  name: string;
  agentName: string;
  cron: string;
  featureFlag: string;
  contextBuilder: () => Promise<ScheduledContext[]>;
}

const registry = new Map<string, ScheduleDefinition>();

export function registerSchedule(def: ScheduleDefinition): void {
  registry.set(def.name, def);
}

export function getSchedule(name: string): ScheduleDefinition {
  const def = registry.get(name);
  if (!def) throw new Error(`Schedule not found: ${name}`);
  return def;
}

export function listSchedules(): ScheduleDefinition[] {
  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface RunScheduledResult {
  ran: boolean;
  reason?: string;
  count: number;
  results: Array<{ ok: boolean; status?: string; error?: string }>;
}

export async function runScheduled(name: string): Promise<RunScheduledResult> {
  const schedule = getSchedule(name);
  if (!isAgentEnabled(schedule.featureFlag)) {
    return { ran: false, reason: "feature_disabled", count: 0, results: [] };
  }

  const contexts = await schedule.contextBuilder();
  const results: RunScheduledResult["results"] = [];
  for (const { input, ctx } of contexts) {
    try {
      const res = await runAgent(schedule.agentName, input, {
        ...(ctx ?? {}),
        triggeredBy: "SCHEDULE",
      });
      results.push({ ok: true, status: res.status });
    } catch (e) {
      results.push({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { ran: true, count: contexts.length, results };
}
