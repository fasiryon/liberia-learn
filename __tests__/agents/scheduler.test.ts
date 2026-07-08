import { describe, it, expect, vi, beforeEach } from "vitest";

const runAgent = vi.fn();
vi.mock("@/lib/agents/runtime", () => ({
  runAgent: (...a: unknown[]) => runAgent(...a),
}));

import {
  registerSchedule,
  getSchedule,
  listSchedules,
  runScheduled,
} from "@/lib/agents/scheduler";

registerSchedule({
  name: "test-digest",
  agentName: "echo",
  cron: "0 6 * * 0",
  featureFlag: "AGENT_SCHED_TEST_ENABLED",
  contextBuilder: async () => [
    { input: "digest for u1", ctx: { userId: "u1", userRole: "admin" } },
    { input: "digest for u2", ctx: { userId: "u2", userRole: "admin" } },
  ],
});

describe("scheduler registry", () => {
  it("registers and lists schedules", () => {
    expect(getSchedule("test-digest").agentName).toBe("echo");
    expect(listSchedules().map((s) => s.name)).toContain("test-digest");
  });
  it("throws for an unknown schedule", () => {
    expect(() => getSchedule("nope")).toThrow(/not found/i);
  });
});

describe("runScheduled", () => {
  beforeEach(() => {
    runAgent.mockReset();
    runAgent.mockResolvedValue({ status: "SUCCESS" });
    process.env.AGENT_SCHED_TEST_ENABLED = "true";
  });

  it("skips when the schedule feature flag is off", async () => {
    delete process.env.AGENT_SCHED_TEST_ENABLED;
    const r = await runScheduled("test-digest");
    expect(r.ran).toBe(false);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("runs the agent once per built context with SCHEDULE trigger", async () => {
    const r = await runScheduled("test-digest");
    expect(r.ran).toBe(true);
    expect(r.count).toBe(2);
    expect(runAgent).toHaveBeenCalledTimes(2);
    expect(runAgent).toHaveBeenCalledWith(
      "echo",
      "digest for u1",
      expect.objectContaining({ userId: "u1", triggeredBy: "SCHEDULE" })
    );
  });

  it("continues past a failing context and reports per-context results", async () => {
    runAgent.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ status: "SUCCESS" });
    const r = await runScheduled("test-digest");
    expect(r.ran).toBe(true);
    expect(r.results.filter((x) => x.ok).length).toBe(1);
    expect(r.results.filter((x) => !x.ok).length).toBe(1);
  });
});
