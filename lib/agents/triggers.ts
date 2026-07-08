import { runAgent, type RunContext } from "@/lib/agents/runtime";
import { isAgentEnabled } from "@/lib/agents/flags";
import { logger } from "@/lib/logger";

/**
 * Event-triggered agents. A trigger binds an agent to an event type with an
 * optional payload filter and a contextBuilder. `emitAgentEvent` is the bus:
 * anything (a Prisma hook, a route, a job) can publish an event and matching
 * triggers run. For pilot scale this is direct invocation; swap for a queue if
 * it ever overloads.
 */
export interface TriggerDefinition<P = any> {
  name: string;
  eventType: string;
  agentName: string;
  featureFlag: string;
  filter?: (payload: P) => boolean;
  contextBuilder: (payload: P) => { input: string; ctx?: RunContext };
}

const registry = new Map<string, TriggerDefinition>();

export function registerTrigger(def: TriggerDefinition): void {
  registry.set(def.name, def);
}

export function listTriggers(): TriggerDefinition[] {
  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface EmitResult {
  fired: number;
  results: Array<{ trigger: string; ok: boolean; status?: string; error?: string }>;
}

export async function emitAgentEvent(eventType: string, payload: unknown): Promise<EmitResult> {
  const matches = listTriggers().filter((t) => {
    if (t.eventType !== eventType) return false;
    if (!isAgentEnabled(t.featureFlag)) return false;
    try {
      return t.filter ? t.filter(payload) : true;
    } catch {
      return false;
    }
  });

  const results: EmitResult["results"] = [];
  for (const trigger of matches) {
    try {
      const { input, ctx } = trigger.contextBuilder(payload);
      const res = await runAgent(trigger.agentName, input, { ...(ctx ?? {}), triggeredBy: "EVENT" });
      results.push({ trigger: trigger.name, ok: true, status: res.status });
    } catch (e) {
      results.push({ trigger: trigger.name, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { fired: matches.length, results };
}

/**
 * Prisma `$use`-compatible middleware factory. Attach with
 * `prisma.$use(makeTriggerMiddleware({ StudentProgress: "StudentProgress.created" }))`
 * to publish an event after a create on the named model. Provided as an opt-in
 * integration point — NOT attached to the live client in this sprint (that is a
 * per-agent concern for 6.1+), so no live model is affected.
 */
export function makeTriggerMiddleware(config: Record<string, string>) {
  return async function triggerMiddleware(
    params: { model?: string; action?: string },
    next: (params: any) => Promise<any>
  ): Promise<any> {
    const result = await next(params);
    const eventType = params.model ? config[params.model] : undefined;
    if (eventType && params.action === "create") {
      // Fire-and-forget: a trigger failure must never break the DB write.
      void emitAgentEvent(eventType, result).catch((e) =>
        logger.warn("[agent.trigger] emit failed", {
          eventType,
          message: e instanceof Error ? e.message.slice(0, 200) : String(e),
        })
      );
    }
    return result;
  };
}
