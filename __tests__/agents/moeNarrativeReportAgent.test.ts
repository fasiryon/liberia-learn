import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("moe-narrative-report agent registration", () => {
  const agent = getAgent("moe-narrative-report");

  it("is registered with a moderate temperature for narrative fluency, still low for factual reporting", () => {
    expect(agent.temperature).toBe(0.3);
  });

  it("allows a longer output than content-qa's feedback (reports are longer)", () => {
    expect(agent.maxTokens).toBe(2000);
  });

  it("is gated behind AGENT_MOE_REPORT_ENABLED, defaulting to disabled in prod", () => {
    expect(agent.featureFlag).toBe("AGENT_MOE_REPORT_ENABLED");
  });

  it("is only invocable by the system role, not directly by a human", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("enforces a lower daily cap than content-qa/guardian since this runs monthly/quarterly, not per-submission", () => {
    expect(agent.costLimits.perInvocationUSD).toBe(0.02);
    expect(agent.costLimits.perDayTotalUSD).toBe(10.0);
  });

  it("allowlists exactly the five moereport tools, nothing else", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      [
        "moereport.getScopeData",
        "moereport.getPriorReport",
        "moereport.detectNotableChanges",
        "moereport.saveDraftReport",
        "moereport.flagForHumanReview",
      ].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(5);
  });
});
