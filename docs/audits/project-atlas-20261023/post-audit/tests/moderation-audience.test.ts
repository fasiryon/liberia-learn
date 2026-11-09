import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completion: vi.fn() }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mocks.completion }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { moderateText } from "@/lib/agents/moderation";

beforeEach(() => vi.clearAllMocks());
describe("SEC-R03 moderation audience policy", () => {
  it.each(["timeout", "invalid JSON", "UNCERTAIN"])("guardian moderation fails closed on %s", async failure => {
    if (failure === "timeout") mocks.completion.mockRejectedValue(new Error("synthetic timeout"));
    else mocks.completion.mockResolvedValue({ content: failure === "invalid JSON" ? "not JSON" : '{"verdict":"UNCERTAIN"}' });
    // Spread avoids requiring the future public audience type at the RED commit.
    const options: { audience: "guardian" } = { audience: "guardian" };
    const result = await moderateText("Synthetic guardian text", "output", { ...options, ...{} });
    expect(result.verdict).toBe("UNSAFE");
  });
  it("internal/general moderation retains UNCERTAIN compatibility", async () => {
    mocks.completion.mockRejectedValue(new Error("synthetic timeout"));
    expect((await moderateText("Synthetic internal text", "output")).verdict).toBe("UNCERTAIN");
  });
});
