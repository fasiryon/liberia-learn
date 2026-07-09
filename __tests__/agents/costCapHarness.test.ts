import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/agents/invocationLog", () => ({ persistInvocation: vi.fn(async () => ({ id: "inv" })) }));
vi.mock("@/lib/agents/costAccounting", () => ({ recordSpend: vi.fn(async () => {}) }));
vi.mock("@/lib/agents/control", () => ({ resolveAgentEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: vi.fn(async () => ({ verdict: "SAFE" })) }));
vi.mock("@/lib/agents/translation", () => ({
  detectLanguage: vi.fn(async () => "en"),
  translateToEnglish: vi.fn(async (t: string) => t),
  translateFromEnglish: vi.fn(async (t: string) => t),
}));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: vi.fn(async () => ({ id: "esc" })) }));
// pre-flight caps allow; the per-invocation cap is what we're exercising here
vi.mock("@/lib/agents/costEnforcement", () => ({ checkCostCaps: vi.fn(async () => ({ allowed: true })) }));

const routedCompletion = vi.fn();
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: (...a: unknown[]) => routedCompletion(...a) }));

import { registerAgent } from "@/lib/agents/registry";
import { registerTool } from "@/lib/agents/toolRegistry";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";
import { runAgent } from "@/lib/agents/runtime";
import { makeScriptedCompletion, assertStatus } from "@/lib/agents/testing/harness";

registerPromptDefinition({ key: "agent.cap.system", version: "1.0.0", template: "cap" });
registerTool({
  name: "cap-tool",
  description: "d",
  domain: "system",
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  handler: async () => ({}),
  auditTag: "agent.tool.cap",
  estimatedCostUnits: 1,
  requiresAuth: ["admin"],
});
registerAgent({
  name: "cap-agent",
  description: "d",
  systemPromptKey: "agent.cap.system",
  toolAllowlist: ["cap-tool"],
  maxTokens: 100,
  costLimits: { perInvocationUSD: 0.05, perUserPerDayUSD: 5, perDayTotalUSD: 50 },
  featureFlag: "AGENT_CAP_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
});

describe("cost cap tests (harness)", () => {
  beforeEach(() => routedCompletion.mockReset());

  it("stops with COST_CAPPED once the per-invocation cap is exceeded", async () => {
    // each call costs 0.03; cap is 0.05 → capped after the 2nd call
    const loopForever = JSON.stringify({ action: "tool", tool: "cap-tool", args: {} });
    routedCompletion.mockImplementation(makeScriptedCompletion([loopForever], 0.03));

    const result = await runAgent("cap-agent", "spend", { userId: "u1", userRole: "admin" });

    expect(assertStatus(result, "COST_CAPPED").pass).toBe(true);
    expect(routedCompletion).toHaveBeenCalledTimes(2);
    expect(result.llmCostUSD).toBeCloseTo(0.06, 6);
  });

  it("does not cap a cheap conversation that finishes normally", async () => {
    routedCompletion.mockImplementation(
      makeScriptedCompletion([JSON.stringify({ action: "final", response: "cheap" })], 0.001)
    );
    const result = await runAgent("cap-agent", "hi", { userId: "u1", userRole: "admin" });
    expect(result.status).toBe("SUCCESS");
    expect(result.response).toBe("cheap");
  });
});
