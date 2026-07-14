import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * LiberiaLearn Family, the guardian-facing SMS agent (Sprint 6.1). Invoked by
 * the SMS webhook (a trusted infrastructure caller, not a human clicking a
 * button), hence rolesAllowed: ["system"] rather than ["guardian"]. Per-student
 * data access is authorized inside each guardian.* tool handler against the
 * caller's resolved identity, not by this role gate.
 *
 * NOTE: `temperature` is declared per the sprint spec (predictable, low-variance
 * replies) but lib/ai/routedCompletion.ts does not yet thread a temperature
 * parameter through to the underlying LLM call, same limitation the echo
 * agent has today. Wiring it through touches shared AI routing used by every
 * caller in the app and is out of scope for this sprint; flagged in the
 * sprint report.
 */
export const liberialearnFamilyAgent: AgentDefinition = {
  name: "liberialearn-family",
  description: "SMS assistant for guardians: student progress, attendance, homework, teacher contact.",
  systemPromptKey: "agent.liberialearn-family.system",
  toolAllowlist: [
    "guardian.getStudentProgress",
    "guardian.getRecentActivity",
    "guardian.getUpcomingWork",
    "guardian.getTeacherContact",
    "guardian.triggerDigestNow",
    "guardian.flagForTeacher",
    "guardian.requestPhoneUpdate",
    "safeguarding.escalate",
  ],
  temperature: 0.3,
  maxTokens: 300,
  costLimits: {
    perInvocationUSD: 0.005,
    perUserPerDayUSD: 0.2,
    perDayTotalUSD: 50.0,
  },
  featureFlag: "AGENT_GUARDIAN_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(liberialearnFamilyAgent);
