import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * District Competition / School-Update (Sprint 6.4): generates DRAFT-only
 * district standings narratives and school-facing milestone celebration
 * drafts on top of existing league/leaderboard/streak/delivery data. Lower
 * priority than content-qa or moe-narrative-report per the standing MRR
 * analysis (this agent's value is retention, not margin protection or a
 * deliverable) - scoped tightly to match: 6 tools, no new data layer, drafts
 * only ever feed the existing manual Announcement publish flow.
 *
 * temperature 0.4: the most celebratory/tone-driven writing task of any
 * agent so far - a bit more warmth than moe-narrative-report's 0.3 factual
 * register, still grounded, not free creative writing. maxTokens 600: short
 * drafts, not full reports (moe-narrative-report's 2000 is for a longer,
 * multi-paragraph report).
 */
export const districtUpdateAgent: AgentDefinition = {
  name: "district-update",
  description:
    "Generates DRAFT district-standings narratives and school milestone celebration drafts grounded in existing league/engagement data. Never posts or sends anything.",
  systemPromptKey: "agent.district-update.system",
  toolAllowlist: [
    "districtupdate.getLeagueStandings",
    "districtupdate.getPriorStandings",
    "districtupdate.detectStandingsChanges",
    "districtupdate.getMilestoneCandidates",
    "districtupdate.saveDraftUpdate",
    "districtupdate.flagForHumanReview",
  ],
  temperature: 0.4,
  maxTokens: 600,
  costLimits: {
    perInvocationUSD: 0.01,
    perUserPerDayUSD: 0.01,
    perDayTotalUSD: 10.0,
  },
  featureFlag: "AGENT_DISTRICT_UPDATE_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(districtUpdateAgent);
