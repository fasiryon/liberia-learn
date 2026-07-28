import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * AI Teaching Runtime v1. One turn of a live classroom session per
 * runAgent() call (Escalation Point 2: turn-based, not continuous
 * streaming). Cost limits are provisional pending the real per-session
 * measurement required before classroom use (Escalation Point 3, see
 * scripts/teaching-runtime-cost-sim.ts), set conservatively low here and
 * intended to be revisited once real numbers exist.
 */
export const teachingRuntimeAgent: AgentDefinition = {
  name: "teaching-runtime",
  description:
    "Delivers one turn of a live, curriculum-grounded classroom lesson: narration, comprehension checks, and honest out-of-scope deferrals, plus private facilitator coaching prompts.",
  systemPromptKey: "agent.teaching-runtime.system",
  toolAllowlist: ["teaching.sendWhisperPrompt", "teaching.flagOutOfScope"],
  temperature: 0.3,
  maxTokens: 400,
  costLimits: {
    perInvocationUSD: 0.02,
    perUserPerDayUSD: 3.0,
    perDayTotalUSD: 30.0,
  },
  featureFlag: "AGENT_TEACHING_RUNTIME_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(teachingRuntimeAgent);
