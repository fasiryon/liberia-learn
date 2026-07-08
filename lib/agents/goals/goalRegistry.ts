import type { GoalHandler } from "@/lib/agents/goals/types";

/**
 * Code-based registry of goal handlers, keyed by agent name. A handler defines
 * how one step of a long-running goal is taken. Registered at module load
 * (reviewed via commit), like the agent and tool registries.
 */
const registry = new Map<string, GoalHandler>();

export function registerGoalHandler(agentName: string, handler: GoalHandler): void {
  // Idempotent overwrite is allowed so tests can re-register; production
  // registration happens once per process via module import.
  registry.set(agentName, handler);
}

export function hasGoalHandler(agentName: string): boolean {
  return registry.has(agentName);
}

export function getGoalHandler(agentName: string): GoalHandler {
  const handler = registry.get(agentName);
  if (!handler) {
    throw new Error(`No goal handler registered for agent: ${agentName}`);
  }
  return handler;
}
