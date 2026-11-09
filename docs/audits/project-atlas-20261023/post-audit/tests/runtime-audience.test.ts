import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRole } from "@/lib/agents/types";

const mocks = vi.hoisted(() => ({ completion: vi.fn(), moderate: vi.fn(), persist: vi.fn(), translate: vi.fn(), language: vi.fn() }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mocks.completion }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: mocks.moderate }));
vi.mock("@/lib/agents/control", () => ({ resolveAgentEnabled: async () => true }));
vi.mock("@/lib/agents/invocationLog", () => ({ persistInvocation: mocks.persist }));
vi.mock("@/lib/agents/costAccounting", () => ({ recordSpend: vi.fn() }));
vi.mock("@/lib/agents/costEnforcement", () => ({ checkCostCaps: async () => ({ allowed: true }) }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: vi.fn() }));
vi.mock("@/lib/agents/translation", () => ({ detectLanguage: mocks.language, translateToEnglish: async (text: string) => text, translateFromEnglish: mocks.translate }));
vi.mock("@/lib/ai/promptRegistry", () => ({ getSystemPrompt: () => "Synthetic agent prompt", registerPromptFromFile: vi.fn(), registerPromptDefinition: vi.fn() }));
import { registerAgent, getAgent } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/runtime";
import type { RunContext } from "@/lib/agents/runtime";
import "@/lib/agents/agents/content-qa.agent";
import "@/lib/agents/agents/district-update.agent";
import "@/lib/agents/agents/echo.agent";
import "@/lib/agents/agents/liberialearn-family.agent";
import "@/lib/agents/agents/moe-narrative-report.agent";
import "@/lib/agents/agents/morning-brief.agent";
import "@/lib/agents/agents/ops-sentinel.agent";
import "@/lib/agents/agents/teaching-runtime.agent";

const audiences: ["minor", "guardian", "general"] = ["minor", "guardian", "general"];
for (const audience of audiences) {
  const definition = {
    name: `atlas-audience-${audience}`, description: "Synthetic audience fixture", audience,
    systemPromptKey: "synthetic", toolAllowlist: [], maxTokens: 40,
    costLimits: { perInvocationUSD: 1, perUserPerDayUSD: 1, perDayTotalUSD: 1 },
    featureFlag: "SYNTHETIC_ONLY", rolesAllowed: ["system"] satisfies AgentRole[], version: "test",
  };
  registerAgent(definition);
}
const context: RunContext = { userRole: "system", userId: "synthetic-user", schoolId: "synthetic-school" };
const fallback = "I cannot provide a response right now. Please ask your teacher or school staff for help.";
beforeEach(() => {
  vi.clearAllMocks(); mocks.persist.mockResolvedValue({ id: "synthetic-invocation" });
  mocks.language.mockResolvedValue("en"); mocks.translate.mockResolvedValue("SYNTHETIC_UNCHECKED_TRANSLATION");
  mocks.completion.mockResolvedValue({ content: JSON.stringify({ action: "final", response: "SYNTHETIC_UNCHECKED_OUTPUT" }), estimatedCostUSD: 0, inputTokens: 1, outputTokens: 1 });
  mocks.moderate.mockResolvedValue({ verdict: "SAFE" });
});
describe("SEC-R03 public agent runtime release policy", () => {
  it.each(["minor", "guardian"])("%s refuses uncertain input before invoking the model", async audience => {
    mocks.moderate.mockResolvedValue({ verdict: "UNCERTAIN" });
    const result = await runAgent(`atlas-audience-${audience}`, "Synthetic input", context);
    expect(result.status).toBe("FAILURE"); expect(result.response).toBe(fallback);
    expect(mocks.completion).not.toHaveBeenCalled();
    expect(mocks.moderate).toHaveBeenCalledWith("Synthetic input", "input", { audience });
  });
  it.each(["minor", "guardian"])("%s never releases uncertain output, including regeneration", async audience => {
    mocks.moderate.mockResolvedValueOnce({ verdict: "SAFE" }).mockResolvedValue({ verdict: "UNCERTAIN" });
    const result = await runAgent(`atlas-audience-${audience}`, "Synthetic input", context);
    expect(result.status).toBe("ESCALATED"); expect(result.response).toBe(fallback);
    expect(mocks.persist.mock.calls[0][0].output).not.toEqual({ response: "SYNTHETIC_UNCHECKED_OUTPUT" });
  });
  it("a guardian translation is moderated after translation before release", async () => {
    mocks.language.mockResolvedValue("kpe");
    mocks.moderate.mockResolvedValueOnce({ verdict: "SAFE" }).mockResolvedValueOnce({ verdict: "SAFE" }).mockResolvedValue({ verdict: "UNCERTAIN" });
    const result = await runAgent("atlas-audience-guardian", "Synthetic input", context);
    expect(result.status).toBe("ESCALATED"); expect(result.response).toBe(fallback);
    expect(mocks.moderate).toHaveBeenLastCalledWith("SYNTHETIC_UNCHECKED_TRANSLATION", "output", { audience: "guardian" });
  });
  it("internal agents retain their existing uncertain-classifier behavior", async () => {
    mocks.moderate.mockResolvedValue({ verdict: "UNCERTAIN" });
    const result = await runAgent("atlas-audience-general", "Synthetic input", context);
    expect(result.status).toBe("SUCCESS"); expect(result.response).toBe("SYNTHETIC_UNCHECKED_OUTPUT");
  });
  it("all built-in agents explicitly declare an audience; teaching and family are public", async () => {
    for (const name of ["content-qa", "district-update", "echo", "liberialearn-family", "moe-narrative-report", "morning-brief", "ops-sentinel", "teaching-runtime"]) {
      expect(getAgent(name)).toHaveProperty("audience");
    }
    expect(getAgent("teaching-runtime")).toHaveProperty("audience", "minor");
    expect(getAgent("liberialearn-family")).toHaveProperty("audience", "guardian");
  });
});
