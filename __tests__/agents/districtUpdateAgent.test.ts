import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("district-update agent registration", () => {
  const agent = getAgent("district-update");

  it("is registered with the most celebratory temperature of any agent so far", () => {
    expect(agent.temperature).toBe(0.4);
  });

  it("caps output short - drafts, not full reports", () => {
    expect(agent.maxTokens).toBe(600);
  });

  it("is gated behind AGENT_DISTRICT_UPDATE_ENABLED, defaulting to disabled in prod", () => {
    expect(agent.featureFlag).toBe("AGENT_DISTRICT_UPDATE_ENABLED");
  });

  it("is only invocable by the system role, not directly by a human", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("enforces the lower-priority (retention-only) cost caps from the sprint spec", () => {
    expect(agent.costLimits.perInvocationUSD).toBe(0.01);
    expect(agent.costLimits.perDayTotalUSD).toBe(10.0);
  });

  it("allowlists exactly the six districtupdate tools, nothing else", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      [
        "districtupdate.getLeagueStandings",
        "districtupdate.getPriorStandings",
        "districtupdate.detectStandingsChanges",
        "districtupdate.getMilestoneCandidates",
        "districtupdate.saveDraftUpdate",
        "districtupdate.flagForHumanReview",
      ].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(6);
  });
});
