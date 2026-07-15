import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * Ops Sentinel - platform health monitoring (docs/agents/OPS_SENTINEL.md).
 * Registered for platform consistency (feature flag via the standard
 * AgentControl/isAgentEnabled mechanism, admin dashboard visibility) even
 * though the routine sweep (lib/agents/opsSentinel/sweep.ts, run from
 * app/api/cron/ops-sentinel) calls its detector/action functions directly
 * rather than through runAgent's LLM loop - detection and the tier-1/tier-2
 * split are deterministic, not model-judged, matching Sprint 6.1's
 * safeguarding keyword-gate precedent for safety-critical decisions.
 * rolesAllowed: ["system"] - invoked by a cron, not a human clicking a
 * button, same reasoning as the liberialearn-family agent.
 */
export const opsSentinelAgent: AgentDefinition = {
  name: "ops-sentinel",
  description: "Platform health monitoring: cron misses, migration drift, error spikes, cost cap breaches.",
  systemPromptKey: "agent.ops-sentinel.system",
  toolAllowlist: [
    "ops.detectCronMisses",
    "ops.detectMigrationDrift",
    "ops.detectErrorSpike",
    "ops.detectCostCapBreaches",
    "ops.retryCron",
    "ops.clearOpsCaches",
    "ops.proposeFix",
  ],
  maxTokens: 400,
  costLimits: {
    perInvocationUSD: 0.01,
    perUserPerDayUSD: 0.5,
    perDayTotalUSD: 5.0,
  },
  featureFlag: "AGENT_OPS_SENTINEL_ENABLED",
  rolesAllowed: ["system", "admin"],
  version: "1.0.0",
};

registerAgent(opsSentinelAgent);
