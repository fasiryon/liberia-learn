import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("teaching-runtime agent registration", () => {
  const agent = getAgent("teaching-runtime");

  it("is gated behind AGENT_TEACHING_RUNTIME_ENABLED, defaulting to disabled", () => {
    expect(agent.featureFlag).toBe("AGENT_TEACHING_RUNTIME_ENABLED");
  });

  it("is only invocable by the system role (real authz happens at the API route)", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("allowlists exactly the two teaching tools", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      ["teaching.sendWhisperPrompt", "teaching.flagOutOfScope"].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(2);
  });

  it("keeps turn responses short (spoken narration, not a report)", () => {
    expect(agent.maxTokens).toBeLessThanOrEqual(500);
  });

  it("uses a grounded, low-temperature register appropriate for guardrails", () => {
    expect(agent.temperature).toBeLessThanOrEqual(0.3);
  });
});
