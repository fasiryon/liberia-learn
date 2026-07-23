import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("morning-brief agent registration", () => {
  const agent = getAgent("morning-brief");

  it("keeps output short - a digest, not a report", () => {
    expect(agent.maxTokens).toBe(400);
  });

  it("is gated behind AGENT_MORNING_BRIEF_ENABLED, defaulting to disabled in prod", () => {
    expect(agent.featureFlag).toBe("AGENT_MORNING_BRIEF_ENABLED");
  });

  it("is only invocable by the system role, not directly by a human", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("enforces a per-invocation cost at or under the standing $0.005 threshold", () => {
    expect(agent.costLimits.perInvocationUSD).toBeLessThanOrEqual(0.005);
    expect(agent.costLimits.perUserPerDayUSD).toBeLessThanOrEqual(0.005);
  });

  it("allowlists exactly the two morningbrief tools, nothing else", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      ["morningbrief.getTeacherSignals", "morningbrief.saveBrief"].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(2);
  });
});
