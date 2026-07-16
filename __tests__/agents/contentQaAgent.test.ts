import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("content-qa agent registration", () => {
  const agent = getAgent("content-qa");

  it("is registered with a low temperature for grading consistency", () => {
    expect(agent.temperature).toBe(0.2);
  });

  it("is gated behind AGENT_CONTENT_QA_ENABLED, defaulting to disabled in prod", () => {
    expect(agent.featureFlag).toBe("AGENT_CONTENT_QA_ENABLED");
  });

  it("is only invocable by the system role, not directly by a human", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("enforces the pilot-scale cost caps from the sprint spec", () => {
    expect(agent.costLimits.perInvocationUSD).toBe(0.01);
    expect(agent.costLimits.perDayTotalUSD).toBe(20.0);
  });

  it("allowlists exactly the five contentqa tools plus safeguarding.escalate", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      [
        "contentqa.getSubmission",
        "contentqa.getRubric",
        "contentqa.flagForReview",
        "contentqa.writeAdvisoryGrade",
        "contentqa.matchAgainstCurriculum",
        "safeguarding.escalate",
      ].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(6);
  });
});
