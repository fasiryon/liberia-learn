/**
 * Ops Sentinel tools (docs/agents/OPS_SENTINEL.md). Registered in
 * ToolRegistry for platform consistency (admin dashboard visibility, audit
 * tagging) even though the sweep itself (lib/agents/opsSentinel/sweep.ts)
 * calls these functions directly rather than through an LLM tool-call loop -
 * the detection/tiering logic is deterministic by design, not model-judged.
 */
import { z } from "zod";
import { registerTool } from "@/lib/agents/toolRegistry";
import {
  detectCronMisses,
  detectMigrationDrift,
  detectErrorSpike,
  detectCostCapBreaches,
} from "@/lib/agents/opsSentinel/detectors";
import { retryCron, clearOpsCaches, proposeFix } from "@/lib/agents/opsSentinel/actions";
import type { AgentRole, ToolDefinition } from "@/lib/agents/types";

const ALL_ROLES: AgentRole[] = ["student", "teacher", "principal", "guardian", "moe", "admin", "system"];

const detectionOutput = z.object({
  category: z.enum(["cron_miss", "migration_drift", "error_spike", "cost_cap_breach"]),
  detected: z.boolean(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  message: z.string(),
  details: z.record(z.string(), z.unknown()),
});

function makeDetectorTool(
  name: string,
  description: string,
  handler: () => Promise<z.infer<typeof detectionOutput>>
): ToolDefinition {
  return {
    name,
    description,
    domain: "admin",
    inputSchema: z.object({}),
    outputSchema: detectionOutput,
    handler,
    auditTag: `agent.tool.${name}`,
    estimatedCostUnits: 1,
    requiresAuth: ["admin", "system"],
  };
}

registerTool(makeDetectorTool("ops.detectCronMisses", "Check monitored crons for missed heartbeats.", detectCronMisses));
registerTool(makeDetectorTool("ops.detectMigrationDrift", "Check for pending/unfinished Prisma migrations.", detectMigrationDrift));
registerTool(makeDetectorTool("ops.detectErrorSpike", "Check the 24h error-event rate against threshold.", detectErrorSpike));
registerTool(makeDetectorTool("ops.detectCostCapBreaches", "Check for agent invocations that hit a cost cap in the last 24h.", detectCostCapBreaches));

const retryCronInput = z.object({ cronName: z.string() });
const retryCronOutput = z.object({ ok: z.boolean(), status: z.number().optional(), error: z.string().optional() });

export const retryCronTool: ToolDefinition<z.infer<typeof retryCronInput>, z.infer<typeof retryCronOutput>> = {
  name: "ops.retryCron",
  description: "Tier 1 (provably safe): re-invoke a monitored cron's own route once.",
  domain: "admin",
  inputSchema: retryCronInput,
  outputSchema: retryCronOutput,
  handler: (input) => retryCron(input.cronName),
  auditTag: "agent.tool.ops.retryCron",
  estimatedCostUnits: 1,
  requiresAuth: ["admin", "system"],
};
registerTool(retryCronTool);

const clearCachesOutput = z.object({ cleared: z.array(z.string()) });

export const clearOpsCachesTool: ToolDefinition<Record<string, never>, z.infer<typeof clearCachesOutput>> = {
  name: "ops.clearOpsCaches",
  description: "Tier 1 (provably safe): clear known-safe, always-recomputable cache keys.",
  domain: "admin",
  inputSchema: z.object({}),
  outputSchema: clearCachesOutput,
  handler: () => clearOpsCaches(),
  auditTag: "agent.tool.ops.clearOpsCaches",
  estimatedCostUnits: 1,
  requiresAuth: ["admin", "system"],
};
registerTool(clearOpsCachesTool);

const proposeFixInput = detectionOutput;
const proposeFixOutput = z.object({ escalationId: z.string() });

export const proposeFixTool: ToolDefinition<z.infer<typeof proposeFixInput>, z.infer<typeof proposeFixOutput>> = {
  name: "ops.proposeFix",
  description: "Tier 2: propose a fix via EscalationQueue for human approval. Never auto-applies.",
  domain: "admin",
  inputSchema: proposeFixInput,
  outputSchema: proposeFixOutput,
  handler: (input) => proposeFix(input),
  auditTag: "agent.tool.ops.proposeFix",
  estimatedCostUnits: 1,
  requiresAuth: ALL_ROLES,
};
registerTool(proposeFixTool);
