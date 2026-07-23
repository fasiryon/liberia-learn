import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * Morning Brief (Sprint 7.4): a short daily in-app digest per teacher,
 * generated on top of Sprint 7.2's class differentiation rollup - never a
 * new signal-detection pipeline. Invoked by a daily schedule (weekday
 * mornings) or an explicit admin trigger, not a chat interface, hence
 * rolesAllowed: ["system"] - same posture as content-qa and moe-narrative-
 * report.
 *
 * temperature 0.3, maxTokens 400: this is a 2-4 sentence digest, not a
 * report - deliberately kept short and cheap since this runs once per
 * teacher per school day (a much higher invocation volume than moe-
 * narrative-report's monthly/quarterly cadence), so per-invocation cost
 * needed to stay well under the standing contract's $0.005 threshold.
 */
export const morningBriefAgent: AgentDefinition = {
  name: "morning-brief",
  description:
    "Generates a short daily in-app brief for one teacher (students needing intervention, certificate unlocks close, ungraded work) grounded in the existing Sprint 7.2 differentiation rollup. Never sends or notifies anyone.",
  systemPromptKey: "agent.morning-brief.system",
  toolAllowlist: ["morningbrief.getTeacherSignals", "morningbrief.saveBrief"],
  temperature: 0.3,
  maxTokens: 400,
  costLimits: {
    perInvocationUSD: 0.005,
    perUserPerDayUSD: 0.005,
    perDayTotalUSD: 5.0,
  },
  featureFlag: "AGENT_MORNING_BRIEF_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(morningBriefAgent);
