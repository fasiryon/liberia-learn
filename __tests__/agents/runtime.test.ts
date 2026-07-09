import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ── Mocks for side-effecting deps ────────────────────────────────────────────
const routedCompletion = vi.fn();
const persistInvocation = vi.fn();
const recordSpend = vi.fn();

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: (...args: unknown[]) => routedCompletion(...args),
}));
vi.mock("@/lib/agents/invocationLog", () => ({
  persistInvocation: (...args: unknown[]) => persistInvocation(...args),
}));
vi.mock("@/lib/agents/costAccounting", () => ({
  recordSpend: (...args: unknown[]) => recordSpend(...args),
}));
// Cross-cutting deps default to no-op / allow so these tests focus on the loop.
vi.mock("@/lib/agents/costEnforcement", () => ({
  checkCostCaps: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/agents/moderation", () => ({
  moderateText: vi.fn(async () => ({ verdict: "SAFE" })),
}));
vi.mock("@/lib/agents/translation", () => ({
  detectLanguage: vi.fn(async () => "en"),
  translateToEnglish: vi.fn(async (t: string) => t),
  translateFromEnglish: vi.fn(async (t: string) => t),
}));
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: vi.fn(async () => ({ id: "esc-1" })),
}));
// Kill switch resolves to the env flag (no DB override) in these tests.
vi.mock("@/lib/agents/control", () => ({
  resolveAgentEnabled: vi.fn(async (_n: string, flag: string) => process.env[flag]?.trim() === "true"),
}));

import { registerAgent } from "@/lib/agents/registry";
import { registerTool } from "@/lib/agents/toolRegistry";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";
import { runAgent } from "@/lib/agents/runtime";

// ── Test fixtures registered once ────────────────────────────────────────────
registerPromptDefinition({
  key: "agent.rt-test.system",
  version: "1.0.0",
  template: "You are a test agent.",
});
registerTool({
  name: "rt-echo-tool",
  description: "echoes input",
  domain: "system",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  handler: async (input: { text: string }) => ({ echoed: input.text }),
  auditTag: "agent.tool.rt-echo",
  estimatedCostUnits: 2,
  requiresAuth: ["admin"],
});
registerAgent({
  name: "rt-test-agent",
  description: "runtime test agent",
  systemPromptKey: "agent.rt-test.system",
  toolAllowlist: ["rt-echo-tool"],
  maxTokens: 256,
  costLimits: { perInvocationUSD: 0.05, perUserPerDayUSD: 1, perDayTotalUSD: 10 },
  featureFlag: "AGENT_RT_TEST_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
});

function llmResult(content: string, costUSD = 0.001) {
  return {
    content,
    tier: "fast",
    model: "test",
    inputTokens: 10,
    outputTokens: 5,
    estimatedCostUSD: costUSD,
  };
}

const adminCtx = { userId: "u1", userRole: "admin" as const };

describe("runAgent", () => {
  beforeEach(() => {
    routedCompletion.mockReset();
    persistInvocation.mockReset();
    recordSpend.mockReset();
    persistInvocation.mockResolvedValue({ id: "inv-1" });
    recordSpend.mockResolvedValue(undefined);
    process.env.AGENT_RT_TEST_ENABLED = "true";
  });

  it("runs the LLM → tool → LLM → final loop and returns the final response", async () => {
    routedCompletion
      .mockResolvedValueOnce(
        llmResult(
          JSON.stringify({ action: "tool", tool: "rt-echo-tool", args: { text: "hi" } })
        )
      )
      .mockResolvedValueOnce(
        llmResult(JSON.stringify({ action: "final", response: "done: hi" }))
      );

    const result = await runAgent("rt-test-agent", "say hi", adminCtx);

    expect(result.status).toBe("SUCCESS");
    expect(result.response).toBe("done: hi");
    expect(routedCompletion).toHaveBeenCalledTimes(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      tool: "rt-echo-tool",
      ok: true,
      costUnits: 2,
      result: { echoed: "hi" },
    });
    expect(result.toolCostUnits).toBe(2);
    // spend + invocation persisted exactly once
    expect(persistInvocation).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledTimes(1);
    expect(persistInvocation.mock.calls[0][0].status).toBe("SUCCESS");
  });

  it("blocks with FEATURE_DISABLED when the kill switch is off (no LLM call)", async () => {
    delete process.env.AGENT_RT_TEST_ENABLED;
    const result = await runAgent("rt-test-agent", "hi", adminCtx);
    expect(result.status).toBe("FEATURE_DISABLED");
    expect(routedCompletion).not.toHaveBeenCalled();
    expect(persistInvocation).toHaveBeenCalledTimes(1);
    expect(persistInvocation.mock.calls[0][0].status).toBe("FEATURE_DISABLED");
  });

  it("denies a role not in rolesAllowed without calling the LLM", async () => {
    await expect(
      runAgent("rt-test-agent", "hi", { userId: "s1", userRole: "student" })
    ).rejects.toThrow(/role/i);
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("throws for an unknown agent", async () => {
    await expect(runAgent("nope-agent", "hi", adminCtx)).rejects.toThrow(
      /not found/i
    );
  });

  it("stops at max tool-call depth", async () => {
    routedCompletion.mockResolvedValue(
      llmResult(
        JSON.stringify({ action: "tool", tool: "rt-echo-tool", args: { text: "loop" } })
      )
    );
    const result = await runAgent("rt-test-agent", "loop forever", {
      ...adminCtx,
      maxDepth: 3,
    });
    expect(result.status).toBe("FAILURE");
    expect(result.error).toMatch(/depth/i);
    expect(routedCompletion).toHaveBeenCalledTimes(3);
  });

  it("stops with COST_CAPPED when per-invocation cost is exceeded", async () => {
    // cap is 0.05; each call costs 0.03 → capped after the 2nd
    routedCompletion.mockResolvedValue(
      llmResult(
        JSON.stringify({ action: "tool", tool: "rt-echo-tool", args: { text: "x" } }),
        0.03
      )
    );
    const result = await runAgent("rt-test-agent", "spend", adminCtx);
    expect(result.status).toBe("COST_CAPPED");
    expect(routedCompletion).toHaveBeenCalledTimes(2);
    expect(result.llmCostUSD).toBeCloseTo(0.06, 6);
  });

  it("repairs a single malformed-JSON response then succeeds", async () => {
    routedCompletion
      .mockResolvedValueOnce(llmResult("not json at all"))
      .mockResolvedValueOnce(
        llmResult(JSON.stringify({ action: "final", response: "recovered" }))
      );
    const result = await runAgent("rt-test-agent", "hi", adminCtx);
    expect(result.status).toBe("SUCCESS");
    expect(result.response).toBe("recovered");
    expect(routedCompletion).toHaveBeenCalledTimes(2);
  });

  it("fails when JSON is malformed twice", async () => {
    routedCompletion.mockResolvedValue(llmResult("still not json"));
    const result = await runAgent("rt-test-agent", "hi", adminCtx);
    expect(result.status).toBe("FAILURE");
    expect(result.error).toMatch(/json/i);
  });

  it("validates tool args against the tool inputSchema", async () => {
    routedCompletion
      .mockResolvedValueOnce(
        llmResult(
          JSON.stringify({ action: "tool", tool: "rt-echo-tool", args: { wrong: 1 } })
        )
      )
      .mockResolvedValueOnce(
        llmResult(JSON.stringify({ action: "final", response: "after error" }))
      );
    const result = await runAgent("rt-test-agent", "hi", adminCtx);
    // the invalid tool call is recorded as a failed tool call, loop continues
    expect(result.toolCalls[0].ok).toBe(false);
    expect(result.toolCalls[0].error).toBeTruthy();
    expect(result.status).toBe("SUCCESS");
  });
});
