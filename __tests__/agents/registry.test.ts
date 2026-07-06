import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  registerAgent,
  getAgent,
  listAgents,
  hasAgent,
} from "@/lib/agents/registry";
import {
  registerTool,
  getTool,
  listTools,
  toolsForAgent,
} from "@/lib/agents/toolRegistry";
import type { AgentDefinition, ToolDefinition } from "@/lib/agents/types";

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: "test-agent",
    description: "A test agent",
    systemPromptKey: "agent.test.system",
    toolAllowlist: ["test-tool"],
    maxTokens: 256,
    costLimits: {
      perInvocationUSD: 0.01,
      perUserPerDayUSD: 0.1,
      perDayTotalUSD: 1,
    },
    featureFlag: "AGENT_TEST_ENABLED",
    rolesAllowed: ["admin"],
    version: "1.0.0",
    ...overrides,
  };
}

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: "test-tool",
    description: "A test tool",
    domain: "system",
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ echoed: z.string() }),
    handler: async (input: { text: string }) => ({ echoed: input.text }),
    auditTag: "agent.tool.test",
    estimatedCostUnits: 1,
    requiresAuth: ["admin"],
    ...overrides,
  } as ToolDefinition;
}

describe("agentRegistry", () => {
  it("registers and retrieves an agent by name", () => {
    const def = makeAgent({ name: "reg-1" });
    registerAgent(def);
    expect(getAgent("reg-1")).toBe(def);
    expect(hasAgent("reg-1")).toBe(true);
  });

  it("lists registered agents", () => {
    registerAgent(makeAgent({ name: "reg-list-a" }));
    registerAgent(makeAgent({ name: "reg-list-b" }));
    const names = listAgents().map((a) => a.name);
    expect(names).toContain("reg-list-a");
    expect(names).toContain("reg-list-b");
  });

  it("throws when retrieving an unknown agent", () => {
    expect(() => getAgent("does-not-exist-xyz")).toThrow(/not found/i);
    expect(hasAgent("does-not-exist-xyz")).toBe(false);
  });

  it("rejects duplicate agent names", () => {
    registerAgent(makeAgent({ name: "dupe-agent" }));
    expect(() => registerAgent(makeAgent({ name: "dupe-agent" }))).toThrow(
      /already registered/i
    );
  });
});

describe("toolRegistry", () => {
  it("registers and retrieves a tool by name", () => {
    const tool = makeTool({ name: "reg-tool-1" });
    registerTool(tool);
    expect(getTool("reg-tool-1")).toBe(tool);
  });

  it("lists registered tools", () => {
    registerTool(makeTool({ name: "reg-tool-list" }));
    expect(listTools().map((t) => t.name)).toContain("reg-tool-list");
  });

  it("throws when retrieving an unknown tool", () => {
    expect(() => getTool("no-such-tool")).toThrow(/not found/i);
  });

  it("rejects duplicate tool names", () => {
    registerTool(makeTool({ name: "dupe-tool" }));
    expect(() => registerTool(makeTool({ name: "dupe-tool" }))).toThrow(
      /already registered/i
    );
  });

  it("resolves only allowlisted tools for an agent", () => {
    registerTool(makeTool({ name: "allowed-tool" }));
    registerTool(makeTool({ name: "other-tool" }));
    const agent = makeAgent({
      name: "allowlist-agent",
      toolAllowlist: ["allowed-tool"],
    });
    const resolved = toolsForAgent(agent).map((t) => t.name);
    expect(resolved).toEqual(["allowed-tool"]);
  });

  it("throws if an agent allowlists an unregistered tool", () => {
    const agent = makeAgent({
      name: "bad-allowlist-agent",
      toolAllowlist: ["ghost-tool"],
    });
    expect(() => toolsForAgent(agent)).toThrow(/not found/i);
  });
});
