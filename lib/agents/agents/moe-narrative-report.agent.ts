import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * MOE Narrative-Report (Sprint 6.3): generates plain-language written
 * progress reports for MOE officials on top of existing dashboard/export
 * data - never a new data pipeline, never anything but a DRAFT a human must
 * review before it goes anywhere near an actual official. Invoked by
 * schedule or an explicit admin/MOE-official trigger, not a chat interface,
 * hence rolesAllowed: ["system"] - same posture as content-qa.
 *
 * temperature 0.3: narrative writing wants more fluency than content-qa's
 * 0.2 grading consistency, but this is still a factual report, not creative
 * writing - kept low. maxTokens 2000: reports are longer than QA feedback.
 * costLimits.perDayTotalUSD is lower than content-qa/guardian (10.00 vs
 * 20.00/higher) because this runs monthly/quarterly, not per-submission.
 */
export const moeNarrativeReportAgent: AgentDefinition = {
  name: "moe-narrative-report",
  description:
    "Generates DRAFT narrative progress reports for MOE officials (national/district/school scope) grounded in existing MOE dashboard data. Never publishes or sends anything.",
  systemPromptKey: "agent.moe-narrative-report.system",
  toolAllowlist: [
    "moereport.getScopeData",
    "moereport.getPriorReport",
    "moereport.detectNotableChanges",
    "moereport.saveDraftReport",
    "moereport.flagForHumanReview",
  ],
  temperature: 0.3,
  maxTokens: 2000,
  costLimits: {
    perInvocationUSD: 0.02,
    perUserPerDayUSD: 0.02,
    perDayTotalUSD: 10.0,
  },
  featureFlag: "AGENT_MOE_REPORT_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(moeNarrativeReportAgent);
