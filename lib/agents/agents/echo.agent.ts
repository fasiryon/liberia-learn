import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * Echo Agent — test-only, admin-only. Exists solely to validate the harness end
 * to end (registry → kill switch → role gate → LLM→tool→LLM loop → invocation
 * log → cost accounting → admin surface). Ships in no user-facing flow.
 */
export const echoAgent: AgentDefinition = {
  name: "echo",
  description: "Test-only echo agent for harness validation (admin-only).",
  systemPromptKey: "agent.echo.system",
  toolAllowlist: ["echo-tool"],
  maxTokens: 200,
  costLimits: {
    perInvocationUSD: 0.01,
    perUserPerDayUSD: 0.1,
    perDayTotalUSD: 1,
  },
  featureFlag: "AGENT_ECHO_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
};

registerAgent(echoAgent);
