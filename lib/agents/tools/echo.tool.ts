import { z } from "zod";
import { registerTool } from "@/lib/agents/toolRegistry";
import type { ToolDefinition } from "@/lib/agents/types";

/** Test-only tool: returns its input. Used for harness validation. */
export const echoTool: ToolDefinition<{ text: string }, { echoed: string }> = {
  name: "echo-tool",
  description: "Returns the text it is given, unchanged.",
  domain: "system",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  handler: async (input) => ({ echoed: input.text }),
  auditTag: "agent.tool.echo",
  estimatedCostUnits: 1,
  requiresAuth: ["admin"],
};

registerTool(echoTool);
