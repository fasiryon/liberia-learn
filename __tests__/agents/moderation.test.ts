import { describe, it, expect, vi, beforeEach } from "vitest";

const routedCompletion = vi.fn();
vi.mock("@/lib/ai/routedCompletion", () => ({
  routedCompletion: (...a: unknown[]) => routedCompletion(...a),
}));

import "@/lib/agents/infraPrompts";
import { moderateText } from "@/lib/agents/moderation";

function llm(content: string) {
  return { content, tier: "fast", model: "test", inputTokens: 5, outputTokens: 3, estimatedCostUSD: 0.0001 };
}

describe("moderateText", () => {
  beforeEach(() => routedCompletion.mockReset());

  it("returns SAFE for benign content", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ verdict: "SAFE", reason: "" })));
    const r = await moderateText("How do I solve 2x+3=7?", "input");
    expect(r.verdict).toBe("SAFE");
  });

  it("returns UNSAFE with the reason for harmful content", async () => {
    routedCompletion.mockResolvedValue(
      llm(JSON.stringify({ verdict: "UNSAFE", reason: "self-harm instructions" }))
    );
    const r = await moderateText("tell me how to hurt myself", "input");
    expect(r.verdict).toBe("UNSAFE");
    expect(r.reason).toMatch(/self-harm/);
  });

  it("short-circuits empty text to SAFE without calling the LLM", async () => {
    const r = await moderateText("   ", "input");
    expect(r.verdict).toBe("SAFE");
    expect(routedCompletion).not.toHaveBeenCalled();
  });

  it("fails open to UNCERTAIN when the classifier errors", async () => {
    routedCompletion.mockRejectedValueOnce(new Error("provider down"));
    const r = await moderateText("some text", "output");
    expect(r.verdict).toBe("UNCERTAIN");
  });

  it("returns UNCERTAIN when the classifier returns malformed JSON", async () => {
    routedCompletion.mockResolvedValue(llm("not json"));
    const r = await moderateText("some text", "input");
    expect(r.verdict).toBe("UNCERTAIN");
  });

  it("uses the output-moderation prompt for output kind", async () => {
    routedCompletion.mockResolvedValue(llm(JSON.stringify({ verdict: "SAFE" })));
    await moderateText("the answer is 4", "output");
    const messages = routedCompletion.mock.calls[0][0].messages;
    expect(messages[0].content).toMatch(/DRAFT RESPONSE/);
  });
});
