import type { AgentDefinition } from "@/lib/agents/types";

/**
 * Code-based agent registry. Agents are declared in the repo (see
 * lib/agents/agents/*.agent.ts) and registered at module load. Adding an agent
 * requires a commit — agents are security-sensitive and must be reviewed.
 */
const registry = new Map<string, AgentDefinition>();

export function registerAgent(definition: AgentDefinition): AgentDefinition {
  if (registry.has(definition.name)) {
    throw new Error(`Agent already registered: ${definition.name}`);
  }
  registry.set(definition.name, definition);
  return definition;
}

export function hasAgent(name: string): boolean {
  return registry.has(name);
}

export function getAgent(name: string): AgentDefinition {
  const def = registry.get(name);
  if (!def) {
    throw new Error(`Agent not found: ${name}`);
  }
  return def;
}

export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
