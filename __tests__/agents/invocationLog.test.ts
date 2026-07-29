import { describe, it, expect, vi, beforeEach } from "vitest";

const { create, createAudit, transaction } = vi.hoisted(() => ({
  create: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
  },
}));
vi.mock("@/lib/db/writeThrottle", () => ({
  withDbWriteThrottle: (_label: string, fn: () => Promise<unknown>) => fn(),
}));

import { persistInvocation } from "@/lib/agents/invocationLog";

describe("persistInvocation", () => {
  beforeEach(() => {
    create.mockReset();
    createAudit.mockReset();
    transaction.mockReset();
    create.mockResolvedValue({ id: "inv-1" });
    createAudit.mockResolvedValue({ id: "audit-1" });
    transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          agentInvocation: { create },
          auditLog: { create: createAudit },
        })
    );
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
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createAudit).toHaveBeenCalledTimes(1);
    const audit = createAudit.mock.calls[0][0].data;
    expect(audit.action).toBe("agent.invocation");
    expect(audit.resourceType).toBe("AgentInvocation");
    expect(audit.resourceId).toBe("inv-1");
    expect(audit.userId).toBe("u1");
    expect(audit.details.status).toBe("FEATURE_DISABLED");
  });

  it("rejects the whole transaction when the audit row cannot be written", async () => {
    createAudit.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      persistInvocation({
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
        status: "SUCCESS",
      })
    ).rejects.toThrow("audit unavailable");

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
