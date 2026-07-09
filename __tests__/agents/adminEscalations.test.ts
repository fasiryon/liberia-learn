import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
const logAudit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    escalationQueue: {
      findMany: (...a: unknown[]) => findMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));

import { listEscalations, assignEscalation, resolveEscalation } from "@/lib/agents/admin/escalations";

describe("escalation queue admin ops", () => {
  beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
    logAudit.mockReset();
    findMany.mockResolvedValue([{ id: "e1", status: "OPEN" }]);
    update.mockResolvedValue({ id: "e1" });
    logAudit.mockResolvedValue(undefined);
  });

  it("lists escalations, defaulting to OPEN, ordered by priority then age", async () => {
    await listEscalations();
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.status).toBe("OPEN");
    expect(arg.orderBy).toEqual([{ priority: "desc" }, { createdAt: "asc" }]);
  });

  it("lists all statuses when filter is 'all'", async () => {
    await listEscalations("all");
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  it("assign sets IN_PROGRESS + assignedTo and audits", async () => {
    await assignEscalation("e1", "admin-2", "admin-1");
    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "IN_PROGRESS", assignedTo: "admin-2" });
    expect(logAudit.mock.calls[0][0].action).toBe("agent.escalation.assign");
  });

  it("resolve sets RESOLVED + resolvedAt + resolution and audits", async () => {
    await resolveEscalation("e1", "handled by phone call", "admin-1");
    const data = update.mock.calls[0][0].data;
    expect(data.status).toBe("RESOLVED");
    expect(data.resolution).toBe("handled by phone call");
    expect(data.resolvedAt).toBeInstanceOf(Date);
    expect(logAudit.mock.calls[0][0].action).toBe("agent.escalation.resolve");
  });
});
