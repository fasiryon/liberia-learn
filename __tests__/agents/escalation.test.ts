import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
const logAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { escalationQueue: { create: (...a: unknown[]) => create(...a) } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));

import { enqueueEscalation } from "@/lib/agents/escalation";

describe("enqueueEscalation", () => {
  beforeEach(() => {
    create.mockReset();
    logAudit.mockReset();
    create.mockResolvedValue({ id: "esc-1" });
    logAudit.mockResolvedValue(undefined);
  });

  it("creates an OPEN escalation with the given reason and priority", async () => {
    const r = await enqueueEscalation({
      agentName: "echo",
      invocationId: "inv-1",
      userId: "u1",
      reason: "output_moderation_unsafe",
      priority: "HIGH",
    });
    expect(r.id).toBe("esc-1");
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      agentName: "echo",
      invocationId: "inv-1",
      reason: "output_moderation_unsafe",
      priority: "HIGH",
      status: "OPEN",
    });
  });

  it("defaults priority to MEDIUM and audits the escalation", async () => {
    await enqueueEscalation({ agentName: "echo", invocationId: "inv-2", reason: "r" });
    expect(create.mock.calls[0][0].data.priority).toBe("MEDIUM");
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit.mock.calls[0][0].action).toBe("agent.escalation");
  });
});
