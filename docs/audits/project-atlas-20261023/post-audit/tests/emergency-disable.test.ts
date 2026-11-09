import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const controls = new Map<string, boolean | null>();
  const findUnique = vi.fn(), upsert = vi.fn(), audit = vi.fn(), transaction = vi.fn();
  return { controls, findUnique, upsert, audit, transaction,
    tx: { agentControl: { findUnique, upsert }, auditLog: { create: audit } },
    completion: vi.fn(), persist: vi.fn(), scheduledContext: vi.fn(), triggeredContext: vi.fn(),
  };
});
vi.mock("@/lib/db", () => ({ prisma: {
  ...mocks.tx, $transaction: mocks.transaction,
  agentControl: { findUnique: mocks.findUnique, upsert: mocks.upsert, findMany: async () => [...mocks.controls].map(([agentName, enabledOverride]) => ({ agentName, enabledOverride })) },
  agentInvocation: { groupBy: async () => [] }, agentCostAccounting: { findMany: async () => [] },
} }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mocks.completion }));
vi.mock("@/lib/ai/promptRegistry", () => ({ getSystemPrompt: () => "Synthetic prompt" }));
vi.mock("@/lib/agents/invocationLog", () => ({ persistInvocation: mocks.persist }));
vi.mock("@/lib/agents/costAccounting", () => ({ recordSpend: vi.fn(), dayKeyUTC: (date: Date) => date }));
vi.mock("@/lib/agents/costEnforcement", () => ({ checkCostCaps: async () => ({ allowed: true }) }));
vi.mock("@/lib/agents/moderation", () => ({ moderateText: async () => ({ verdict: "SAFE" }) }));
vi.mock("@/lib/agents/translation", () => ({ detectLanguage: async () => "en", translateToEnglish: async (text: string) => text, translateFromEnglish: async (text: string) => text }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: vi.fn() }));
import { registerAgent } from "@/lib/agents/registry";
import { resolveAgentEnabled, setAgentControl } from "@/lib/agents/control";
import { runAgent } from "@/lib/agents/runtime";
import { registerSchedule, runScheduled } from "@/lib/agents/scheduler";
import { registerTrigger, emitAgentEvent } from "@/lib/agents/triggers";
import { listAgentsWithStats } from "@/lib/agents/admin/stats";
const name = "atlas-emergency-agent", flag = "AGENT_ATLAS_SYNTHETIC_ENABLED";
registerAgent({ name, description: "Synthetic emergency fixture", audience: "general", systemPromptKey: "synthetic", toolAllowlist: [], maxTokens: 20, costLimits: { perInvocationUSD: 1, perUserPerDayUSD: 1, perDayTotalUSD: 1 }, featureFlag: flag, rolesAllowed: ["system"], version: "test" });
registerSchedule({ name: "atlas-emergency-schedule", agentName: name, featureFlag: flag, cron: "synthetic-only", contextBuilder: mocks.scheduledContext });
registerTrigger({ name: "atlas-emergency-trigger", agentName: name, featureFlag: flag, eventType: "synthetic.atlas", contextBuilder: mocks.triggeredContext });
beforeEach(() => {
  vi.clearAllMocks(); mocks.controls.clear(); mocks.controls.set(name, true);
  vi.stubEnv(flag, "true"); vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", "false");
  mocks.findUnique.mockImplementation(async ({ where }: { where: { agentName: string } }) => mocks.controls.has(where.agentName) ? { enabledOverride: mocks.controls.get(where.agentName) } : null);
  mocks.upsert.mockImplementation(async ({ where, update }: { where: { agentName: string }; update: { enabledOverride: boolean | null } }) => { mocks.controls.set(where.agentName, update.enabledOverride); return { agentName: where.agentName, ...update }; });
  mocks.audit.mockResolvedValue({ id: "synthetic-audit" });
  mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
    const before = new Map(mocks.controls);
    try { return await callback(mocks.tx); } catch (error) { mocks.controls.clear(); for (const [key, value] of before) mocks.controls.set(key, value); throw error; }
  });
  mocks.persist.mockResolvedValue({ id: "synthetic-invocation" });
  mocks.completion.mockResolvedValue({ content: '{"action":"final","response":"Synthetic reply"}', estimatedCostUSD: 0, inputTokens: 0, outputTokens: 0 });
  mocks.scheduledContext.mockResolvedValue([{ input: "Synthetic input", ctx: { userRole: "system" } }]);
  mocks.triggeredContext.mockReturnValue({ input: "Synthetic input", ctx: { userRole: "system" } });
});
afterEach(() => vi.unstubAllEnvs());
describe("SEC-R07 absolute stop, including infrastructure dispatch", () => {
  it("global emergency disable wins over a true database override", async () => {
    vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", " true\r\n");
    expect(await resolveAgentEnabled(name, flag)).toBe(false);
  });
  it("an explicit false agent env flag wins over its true override", async () => {
    vi.stubEnv(flag, " false\r\n");
    expect(await resolveAgentEnabled(name, flag)).toBe(false);
  });
  it("control: an unset flag permits an intentional database override", async () => {
    vi.stubEnv(flag, undefined);
    expect(await resolveAgentEnabled(name, flag)).toBe(true);
  });
  it("actual runAgent never reaches the model during emergency stop", async () => {
    vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", "true");
    expect((await runAgent(name, "Synthetic input", { userRole: "system" })).status).toBe("FEATURE_DISABLED");
    expect(mocks.completion).not.toHaveBeenCalled();
  });
  it("a scheduled run cannot bypass emergency stop or build its contexts", async () => {
    vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", "true");
    expect((await runScheduled("atlas-emergency-schedule")).ran).toBe(false);
    expect(mocks.scheduledContext).not.toHaveBeenCalled(); expect(mocks.completion).not.toHaveBeenCalled();
  });
  it("a triggered run cannot bypass emergency stop or build its contexts", async () => {
    vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", "true");
    expect((await emitAgentEvent("synthetic.atlas", {})).fired).toBe(0);
    expect(mocks.triggeredContext).not.toHaveBeenCalled(); expect(mocks.completion).not.toHaveBeenCalled();
  });
  it("a database-disabled schedule and trigger stop before context builders", async () => {
    mocks.controls.set(name, false);
    expect((await runScheduled("atlas-emergency-schedule")).ran).toBe(false);
    expect((await emitAgentEvent("synthetic.atlas", {})).fired).toBe(0);
    expect(mocks.scheduledContext).not.toHaveBeenCalled(); expect(mocks.triggeredContext).not.toHaveBeenCalled();
  });
  it("admin stats expose the same effective state and its source", async () => {
    vi.stubEnv("AGENT_PLATFORM_EMERGENCY_DISABLED", "true");
    const rows = await listAgentsWithStats();
    expect(rows.find(row => row.name === name)).toMatchObject({ effectiveEnabled: false, effectiveStateSource: "global_emergency_disable" });
  });
  it("restoring a control is transactionally audited with its actor", async () => {
    await setAgentControl(name, false, "synthetic-platform-admin");
    await setAgentControl(name, true, "synthetic-platform-admin");
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.audit).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "synthetic-platform-admin", action: "agent.control.updated" }) }));
  });
  it("a failed audit rolls back a requested restore", async () => {
    mocks.controls.set(name, false); mocks.audit.mockRejectedValueOnce(new Error("synthetic audit unavailable"));
    await expect(setAgentControl(name, true, "synthetic-platform-admin")).rejects.toThrow("synthetic audit unavailable");
    expect(mocks.controls.get(name)).toBe(false);
  });
});
