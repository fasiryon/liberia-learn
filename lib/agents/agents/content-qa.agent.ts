import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * Content QA (Sprint 6.2): first-pass advisory review of teacher-submitted
 * lesson content, teacher-uploaded video metadata, and already-graded
 * student essay/code submissions. Invoked by submission events (a sweep
 * cron, see app/api/cron/content-qa-sweep), not a human chat interface,
 * hence rolesAllowed: ["system"] — same posture as liberialearn-family.
 *
 * temperature 0.2: grading/QA wants consistency over creativity, unlike the
 * guardian agent's conversational 0.3. Same routedCompletion limitation
 * applies (temperature not yet threaded through — see
 * liberialearn-family.agent.ts note); flagged again here rather than
 * silently duplicated.
 */
export const contentQaAgent: AgentDefinition = {
  name: "content-qa",
  description:
    "First-pass advisory review of lesson content, video uploads, and essay/code submissions. Never publishes, approves, or finalizes anything.",
  systemPromptKey: "agent.content-qa.system",
  toolAllowlist: [
    "contentqa.getSubmission",
    "contentqa.getRubric",
    "contentqa.flagForReview",
    "contentqa.writeAdvisoryGrade",
    "contentqa.matchAgainstCurriculum",
    "safeguarding.escalate",
  ],
  temperature: 0.2,
  maxTokens: 800,
  costLimits: {
    perInvocationUSD: 0.01,
    perUserPerDayUSD: 0.01,
    perDayTotalUSD: 20.0,
  },
  featureFlag: "AGENT_CONTENT_QA_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(contentQaAgent);
