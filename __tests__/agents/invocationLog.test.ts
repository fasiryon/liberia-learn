import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const logAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    agentInvocation: {
      get create() {
        return create;
      },
    },
  },
}));
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => logAudit(...args),
}));
vi.mock("@/lib/db/writeThrottle", () => ({
  withDbWriteThrottle: (_label: string, fn: () => Promise<unknown>) => fn(),
}));

import { persistInvocation } from "@/lib/agents/invocationLog";

describe("persistInvocation", () => {
  beforeEach(() => {
    create.mockReset();
    logAudit.mockReset();
    create.mockResolvedValue({ id: "inv-1" });
    logAudit.mockResolvedValue(undefined);
  });

  it("writes an AgentInvocation row with rounded cost and returns it", async () => {
    const row = await persistInvocation({
      agentName: "echo",
      agentVersion: "1.0.0",
      userId: "u1",
      triggeredBy: "USER",
      input: { text: "hi" },
      output: { response: "hi" },
      toolCalls: [{ tool: "echo-tool", args: {}, costUnits: 1, ok: true }],
      llmTokensIn: 10,
      llmTokensOut: 5,
      llmCostUSD: 0.00123456,
      toolCostUnits: 1,
      latencyMs: 42,
      status: "SUCCESS",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.agentName).toBe("echo");
    expect(data.status).toBe("SUCCESS");
    expect(data.triggeredBy).toBe("USER");
    // cost rounded to 6dp (>= 4dp accuracy)
    expect(data.llmCostUSD).toBeCloseTo(0.001235, 6);
    expect(Array.isArray(data.toolCalls)).toBe(true);
    expect(row.id).toBe("inv-1");
  });

  it("audits the invocation with the created row id", async () => {
    await persistInvocation({
      agentName: "echo",
      agentVersion: "1.0.0",
      userId: "u1",
      triggeredBy: "USER",
      input: {},
      toolCalls: [],
      llmTokensIn: 0,
      llmTokensOut: 0,
      llmCostUSD: 0,
      toolCostUnits: 0,
      latencyMs: 1,
      status: "FEATURE_DISABLED",
    });
    expect(logAudit).toHaveBeenCalledTimes(1);
    const audit = logAudit.mock.calls[0][0];
    expect(audit.action).toBe("agent.invocation");
    expect(audit.resourceType).toBe("AgentInvocation");
    expect(audit.resourceId).toBe("inv-1");
    expect(audit.userId).toBe("u1");
    expect(audit.details.status).toBe("FEATURE_DISABLED");
  });
});
