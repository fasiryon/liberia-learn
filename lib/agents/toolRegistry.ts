import type { AgentDefinition, ToolDefinition } from "@/lib/agents/types";

/**
 * Code-based tool registry. Tools are declared in lib/agents/tools/*.tool.ts
 * and registered at module load. Each tool carries Zod input/output schemas so
 * the runtime can validate model-produced arguments before dispatch.
 */
const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): ToolDefinition {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool);
  return tool;
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function getTool(name: string): ToolDefinition {
  const tool = registry.get(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return tool;
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Resolve an agent's allowlisted tools; throws if any is unregistered. */
export function toolsForAgent(agent: AgentDefinition): ToolDefinition[] {
  return agent.toolAllowlist.map((name) => getTool(name));
}
