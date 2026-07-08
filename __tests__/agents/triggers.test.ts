import { describe, it, expect, vi, beforeEach } from "vitest";

const runAgent = vi.fn();
vi.mock("@/lib/agents/runtime", () => ({
  runAgent: (...a: unknown[]) => runAgent(...a),
}));

import {
  registerTrigger,
  listTriggers,
  emitAgentEvent,
  makeTriggerMiddleware,
} from "@/lib/agents/triggers";

registerTrigger({
  name: "at-risk-detector",
  eventType: "StudentProgress.created",
  agentName: "echo",
  featureFlag: "AGENT_TRIG_TEST_ENABLED",
  filter: (payload: { score?: number }) => (payload?.score ?? 1) < 0.4,
  contextBuilder: (payload: { studentId?: string }) => ({
    input: `at-risk student ${payload?.studentId}`,
    ctx: { userRole: "admin" as const },
  }),
});

describe("trigger registry + event bus", () => {
  beforeEach(() => {
    runAgent.mockReset();
    runAgent.mockResolvedValue({ status: "SUCCESS" });
    process.env.AGENT_TRIG_TEST_ENABLED = "true";
  });

  it("lists registered triggers", () => {
    expect(listTriggers().map((t) => t.name)).toContain("at-risk-detector");
  });

  it("fires a matching trigger with EVENT trigger source", async () => {
    const r = await emitAgentEvent("StudentProgress.created", { studentId: "s1", score: 0.2 });
    expect(r.fired).toBe(1);
    expect(runAgent).toHaveBeenCalledWith(
      "echo",
      "at-risk student s1",
      expect.objectContaining({ triggeredBy: "EVENT" })
    );
  });

  it("does not fire when the filter rejects the payload", async () => {
    const r = await emitAgentEvent("StudentProgress.created", { studentId: "s1", score: 0.9 });
    expect(r.fired).toBe(0);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("does not fire for a different event type", async () => {
    const r = await emitAgentEvent("SomethingElse.created", { score: 0.1 });
    expect(r.fired).toBe(0);
  });

  it("does not fire when the trigger feature flag is off", async () => {
    delete process.env.AGENT_TRIG_TEST_ENABLED;
    const r = await emitAgentEvent("StudentProgress.created", { studentId: "s1", score: 0.1 });
    expect(r.fired).toBe(0);
    expect(runAgent).not.toHaveBeenCalled();
  });
});

describe("makeTriggerMiddleware (Prisma $use-compatible hook)", () => {
  beforeEach(() => {
    runAgent.mockReset();
    runAgent.mockResolvedValue({ status: "SUCCESS" });
    process.env.AGENT_TRIG_TEST_ENABLED = "true";
  });

  it("emits an event after a create on a configured model and returns the result", async () => {
    const mw = makeTriggerMiddleware({ StudentProgress: "StudentProgress.created" });
    const next = vi.fn(async () => ({ studentId: "s9", score: 0.1 }));
    const result = await mw({ model: "StudentProgress", action: "create" }, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ studentId: "s9", score: 0.1 });
    // trigger fired for the emitted event
    expect(runAgent).toHaveBeenCalledWith(
      "echo",
      "at-risk student s9",
      expect.objectContaining({ triggeredBy: "EVENT" })
    );
  });

  it("does not emit for unconfigured models or non-create actions", async () => {
    const mw = makeTriggerMiddleware({ StudentProgress: "StudentProgress.created" });
    const next = vi.fn(async () => ({ id: "x" }));
    await mw({ model: "User", action: "create" }, next);
    await mw({ model: "StudentProgress", action: "update" }, next);
    expect(runAgent).not.toHaveBeenCalled();
  });
});
