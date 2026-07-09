import { describe, it, expect, vi, beforeEach } from "vitest";

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
vi.mock("@/lib/agents/control", () => ({
  resolveAgentEnabled: vi.fn(async (_n: string, flag: string) => process.env[flag]?.trim() === "true"),
}));

// Registers echo agent + tool + file-loaded prompt as a side effect.
import "@/lib/agents/bootstrap";
import { runAgent } from "@/lib/agents/runtime";
import { getAgent } from "@/lib/agents/registry";
import { getSystemPrompt } from "@/lib/ai/promptRegistry";

function llm(content: string) {
  return {
    content,
    tier: "fast",
    model: "test",
    inputTokens: 8,
    outputTokens: 4,
    estimatedCostUSD: 0.0002,
  };
}

describe("echo agent (end to end, LLM mocked)", () => {
  beforeEach(() => {
    routedCompletion.mockReset();
    persistInvocation.mockReset();
    recordSpend.mockReset();
    persistInvocation.mockResolvedValue({ id: "inv-echo" });
    recordSpend.mockResolvedValue(undefined);
    process.env.AGENT_ECHO_ENABLED = "true";
  });

  it("is registered admin-only with a file-loaded system prompt", () => {
    const agent = getAgent("echo");
    expect(agent.rolesAllowed).toEqual(["admin"]);
    expect(agent.toolAllowlist).toEqual(["echo-tool"]);
    // prompt came from echo.md, not a hardcoded string in the definition
    expect(getSystemPrompt("agent.echo.system")).toMatch(/Echo Agent/);
  });

  it("echoes the user input through the tool and logs the invocation", async () => {
    routedCompletion
      .mockResolvedValueOnce(
        llm(
          JSON.stringify({
            action: "tool",
            tool: "echo-tool",
            args: { text: "hello harness" },
          })
        )
      )
      .mockResolvedValueOnce(
        llm(JSON.stringify({ action: "final", response: "hello harness" }))
      );

    const result = await runAgent("echo", "hello harness", {
      userId: "admin-1",
      userRole: "admin",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.response).toBe("hello harness");
    expect(result.toolCalls[0]).toMatchObject({
      tool: "echo-tool",
      ok: true,
      result: { echoed: "hello harness" },
    });
    expect(result.invocationId).toBe("inv-echo");
    expect(persistInvocation).toHaveBeenCalledTimes(1);
    expect(recordSpend).toHaveBeenCalledWith(
      expect.objectContaining({ agentName: "echo" })
    );
  });

  it("respects the kill switch", async () => {
    delete process.env.AGENT_ECHO_ENABLED;
    const result = await runAgent("echo", "hi", {
      userId: "admin-1",
      userRole: "admin",
    });
    expect(result.status).toBe("FEATURE_DISABLED");
    expect(routedCompletion).not.toHaveBeenCalled();
  });
});
