import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const routedCompletion = vi.fn();
const persistInvocation = vi.fn();
const recordSpend = vi.fn();
const checkCostCaps = vi.fn();
const moderateText = vi.fn();
const detectLanguage = vi.fn();
const translateToEnglish = vi.fn();
const translateFromEnglish = vi.fn();
const enqueueEscalation = vi.fn();

vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: (...a: unknown[]) => routedCompletion(...a),
}));
vi.mock("@/lib/agents/invocationLog", () => ({
  persistInvocation: (...a: unknown[]) => persistInvocation(...a),
}));
vi.mock("@/lib/agents/costAccounting", () => ({
  recordSpend: (...a: unknown[]) => recordSpend(...a),
}));
vi.mock("@/lib/agents/costEnforcement", () => ({
  checkCostCaps: (...a: unknown[]) => checkCostCaps(...a),
}));
vi.mock("@/lib/agents/moderation", () => ({
  moderateText: (...a: unknown[]) => moderateText(...a),
}));
vi.mock("@/lib/agents/translation", () => ({
  detectLanguage: (...a: unknown[]) => detectLanguage(...a),
  translateToEnglish: (...a: unknown[]) => translateToEnglish(...a),
  translateFromEnglish: (...a: unknown[]) => translateFromEnglish(...a),
}));
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: (...a: unknown[]) => enqueueEscalation(...a),
}));
vi.mock("@/lib/agents/control", () => ({
  resolveAgentEnabled: vi.fn(async (_n: string, flag: string) => process.env[flag]?.trim() === "true"),
}));

import { registerAgent } from "@/lib/agents/registry";
import { registerTool } from "@/lib/agents/toolRegistry";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";
import { runAgent } from "@/lib/agents/runtime";

registerPromptDefinition({ key: "agent.cc.system", version: "1.0.0", template: "cc test agent" });
registerTool({
  name: "cc-tool",
  description: "noop",
  domain: "system",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  handler: async (i: { text: string }) => ({ echoed: i.text }),
  auditTag: "agent.tool.cc",
  estimatedCostUnits: 1,
  requiresAuth: ["admin"],
});
registerAgent({
  name: "cc-agent",
  description: "crosscutting test agent",
  systemPromptKey: "agent.cc.system",
  toolAllowlist: ["cc-tool"],
  maxTokens: 200,
  costLimits: { perInvocationUSD: 1, perUserPerDayUSD: 5, perDayTotalUSD: 50 },
  featureFlag: "AGENT_CC_ENABLED",
  rolesAllowed: ["admin"],
  version: "1.0.0",
});

function final(text: string) {
  return {
    content: JSON.stringify({ action: "final", response: text }),
    tier: "fast",
    model: "test",
    inputTokens: 10,
    outputTokens: 5,
    estimatedCostUSD: 0.001,
  };
}

const ctx = { userId: "u1", userRole: "admin" as const };

describe("runAgent — cross-cutting wiring", () => {
  beforeEach(() => {
    [routedCompletion, persistInvocation, recordSpend, checkCostCaps, moderateText,
     detectLanguage, translateToEnglish, translateFromEnglish, enqueueEscalation].forEach((m) => m.mockReset());
    persistInvocation.mockResolvedValue({ id: "inv-1" });
    recordSpend.mockResolvedValue(undefined);
    enqueueEscalation.mockResolvedValue({ id: "esc-1" });
    // Safe defaults: caps allow, everything SAFE, English passthrough.
    checkCostCaps.mockResolvedValue({ allowed: true });
    moderateText.mockResolvedValue({ verdict: "SAFE" });
    detectLanguage.mockResolvedValue("en");
    translateToEnglish.mockImplementation(async (t: string) => t);
    translateFromEnglish.mockImplementation(async (t: string) => t);
    process.env.AGENT_CC_ENABLED = "true";
  });

  it("blocks pre-flight when a cost cap is exceeded (no LLM call)", async () => {
    checkCostCaps.mockResolvedValue({ allowed: false, reason: "day_total_cap" });
    const r = await runAgent("cc-agent", "hi", ctx);
    expect(r.status).toBe("COST_CAPPED");
    expect(routedCompletion).not.toHaveBeenCalled();
    expect(persistInvocation.mock.calls[0][0].status).toBe("COST_CAPPED");
  });

  it("blocks when input moderation returns UNSAFE (no LLM call)", async () => {
    moderateText.mockImplementation(async (_t: string, kind: string) =>
      kind === "input" ? { verdict: "UNSAFE", reason: "self-harm" } : { verdict: "SAFE" }
    );
    const r = await runAgent("cc-agent", "harmful", ctx);
    expect(r.status).toBe("FAILURE");
    expect(r.error).toMatch(/input_moderation/);
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("regenerates once when output is UNSAFE, then succeeds if the retry is SAFE", async () => {
    routedCompletion
      .mockResolvedValueOnce(final("bad answer"))
      .mockResolvedValueOnce(final("good answer"));
    moderateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "x" }) // output pass 1
      .mockResolvedValueOnce({ verdict: "SAFE" }); // output pass 2
    const r = await runAgent("cc-agent", "hi", ctx);
    expect(r.status).toBe("SUCCESS");
    expect(r.response).toBe("good answer");
    expect(routedCompletion).toHaveBeenCalledTimes(2);
    expect(enqueueEscalation).not.toHaveBeenCalled();
  });

  it("escalates when output stays UNSAFE after one regeneration", async () => {
    routedCompletion.mockResolvedValue(final("still bad"));
    moderateText
      .mockResolvedValueOnce({ verdict: "SAFE" }) // input
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "x" }) // output pass 1
      .mockResolvedValueOnce({ verdict: "UNSAFE", reason: "x" }); // output pass 2
    const r = await runAgent("cc-agent", "hi", ctx);
    expect(r.status).toBe("ESCALATED");
    expect(r.response).toBeNull();
    expect(enqueueEscalation).toHaveBeenCalledTimes(1);
    expect(enqueueEscalation.mock.calls[0][0]).toMatchObject({
      agentName: "cc-agent",
      reason: expect.stringMatching(/output_moderation/),
    });
  });

  it("translates non-English input to English and the response back", async () => {
    detectLanguage.mockResolvedValue("fr");
    translateToEnglish.mockResolvedValue("english question");
    translateFromEnglish.mockResolvedValue("réponse française");
    routedCompletion.mockResolvedValue(final("english answer"));
    const r = await runAgent("cc-agent", "question française", ctx);
    expect(r.status).toBe("SUCCESS");
    expect(translateToEnglish).toHaveBeenCalledWith("question française", "fr");
    expect(translateFromEnglish).toHaveBeenCalledWith("english answer", "fr");
    expect(r.response).toBe("réponse française");
    // the LLM saw the English translation, not the French original
    const firstUserMsg = routedCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(firstUserMsg.content).toBe("english question");
  });
});
