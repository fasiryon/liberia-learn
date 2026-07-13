import { describe, it, expect } from "vitest";

// Registers the agent + its tools + its file-loaded prompt as a side effect.
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { getTool } from "@/lib/agents/toolRegistry";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";

describe("liberialearn-family agent registration", () => {
  it("is registered with the spec'd cost limits, tokens, and feature flag", () => {
    const agent = getAgent("liberialearn-family");
    expect(agent.maxTokens).toBe(300);
    expect(agent.temperature).toBe(0.3);
    expect(agent.costLimits).toEqual({
      perInvocationUSD: 0.005,
      perUserPerDayUSD: 0.2,
      perDayTotalUSD: 50.0,
    });
    expect(agent.featureFlag).toBe("AGENT_GUARDIAN_ENABLED");
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("allowlists exactly the 7 guardian/safeguarding tools by exact name (no glob)", () => {
    const agent = getAgent("liberialearn-family");
    expect(agent.toolAllowlist.sort()).toEqual(
      [
        "guardian.getStudentProgress",
        "guardian.getRecentActivity",
        "guardian.getUpcomingWork",
        "guardian.getTeacherContact",
        "guardian.triggerDigestNow",
        "guardian.flagForTeacher",
        "safeguarding.escalate",
      ].sort()
    );
    for (const name of agent.toolAllowlist) {
      expect(() => getTool(name)).not.toThrow();
    }
  });

  it("loads its system prompt from a file, not a hardcoded string, and it covers the required sections", () => {
    const prompt = getSystemPrompt("agent.liberialearn-family.system");
    expect(prompt).toMatch(/LiberiaLearn Family/);
    expect(prompt).toMatch(/safeguarding\.escalate/);
    expect(prompt).toMatch(/Reply 1 for weekly\s+report/);
    expect(prompt).toMatch(/I do not recognize your number/);
  });
});
