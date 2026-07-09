import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// no-op the DB-touching deps so the harness self-test drives only the loop
vi.mock("@/lib/agents/invocationLog", () => ({ persistInvocation: vi.fn(async () => ({ id: "inv" })) }));
vi.mock("@/lib/agents/costAccounting", () => ({ recordSpend: vi.fn(async () => {}) }));
vi.mock("@/lib/agents/control", () => ({ resolveAgentEnabled: vi.fn(async () => true) }));
vi.mock("@/lib/agents/costEnforcement", () => ({ checkCostCaps: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: vi.fn(async () => ({ verdict: "SAFE" })) }));
vi.mock("@/lib/agents/translation", () => ({
  detectLanguage: vi.fn(async () => "en"),
  translateToEnglish: vi.fn(async (t: string) => t),
  translateFromEnglish: vi.fn(async (t: string) => t),
}));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: vi.fn(async () => ({ id: "esc" })) }));

const routedCompletion = vi.fn();
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: (...a: unknown[]) => routedCompletion(...a) }));

import { registerAgent } from "@/lib/agents/registry";
import { registerTool } from "@/lib/agents/toolRegistry";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";
import { runAgent } from "@/lib/agents/runtime";
import {
  makeScriptedCompletion,
  buildFixture,
  diffFixture,
  assertToolCalled,
  assertStatus,
  assertFinalIncludes,
} from "@/lib/agents/testing/harness";

registerPromptDefinition({ key: "agent.harness.system", version: "1.0.0", template: "harness" });
registerTool({
  name: "h-tool",
  description: "d",
  domain: "system",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  handler: async (i: { text: string }) => ({ echoed: i.text }),
  auditTag: "agent.tool.h",
  estimatedCostUnits: 1,
  requiresAuth: ["admin"],
});
registerAgent({
  name: "harness-agent",
  description: "d",
  systemPromptKey: "agent.harness.system",
  toolAllowlist: ["h-tool"],
  maxTokens: 100,
  costLimits: { perInvocationUSD: 1, perUserPerDayUSD: 5, perDayTotalUSD: 50 },
  featureFlag: "AGENT_HARNESS_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
});

const SCRIPT = [
  JSON.stringify({ action: "tool", tool: "h-tool", args: { text: "hi" } }),
  JSON.stringify({ action: "final", response: "done hi" }),
];
const ctx = { userId: "u1", userRole: "admin" as const };

describe("behavior assertions", () => {
  const result = {
    status: "SUCCESS" as const,
    response: "the answer is 4",
    invocationId: "i",
    toolCalls: [{ tool: "h-tool", args: {}, costUnits: 1, ok: true }],
    llmCostUSD: 0,
    llmTokensIn: 0,
    llmTokensOut: 0,
    toolCostUnits: 1,
  };
  it("assertToolCalled passes when the tool was called", () => {
    expect(assertToolCalled(result, "h-tool").pass).toBe(true);
    expect(assertToolCalled(result, "other").pass).toBe(false);
  });
  it("assertStatus checks the run status", () => {
    expect(assertStatus(result, "SUCCESS").pass).toBe(true);
    expect(assertStatus(result, "FAILURE").pass).toBe(false);
  });
  it("assertFinalIncludes checks the response text", () => {
    expect(assertFinalIncludes(result, "answer").pass).toBe(true);
    expect(assertFinalIncludes(result, "nope").pass).toBe(false);
  });
});

describe("record and replay", () => {
  beforeEach(() => {
    routedCompletion.mockReset();
  });

  it("records a conversation then replays it with no diff", async () => {
    routedCompletion.mockImplementation(makeScriptedCompletion(SCRIPT));
    const recorded = await runAgent("harness-agent", "hi", ctx);
    const fixture = buildFixture("harness-agent", "hi", recorded);
    expect(fixture.expected.status).toBe("SUCCESS");
    expect(fixture.expected.toolCalls).toEqual([{ tool: "h-tool", ok: true }]);

    // replay against the same script → identical behavior
    routedCompletion.mockImplementation(makeScriptedCompletion(SCRIPT));
    const replayed = await runAgent("harness-agent", "hi", ctx);
    expect(diffFixture(fixture, replayed)).toEqual([]);
  });

  it("detects a behavior regression on replay", async () => {
    routedCompletion.mockImplementation(makeScriptedCompletion(SCRIPT));
    const fixture = buildFixture("harness-agent", "hi", await runAgent("harness-agent", "hi", ctx));

    // modified behavior: agent answers directly without calling the tool
    routedCompletion.mockImplementation(
      makeScriptedCompletion([JSON.stringify({ action: "final", response: "different" })])
    );
    const diffs = diffFixture(fixture, await runAgent("harness-agent", "hi", ctx));
    expect(diffs.length).toBeGreaterThan(0);
  });
});
