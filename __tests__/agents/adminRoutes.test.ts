import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const runAgent = vi.fn();

vi.mock("@/lib/auth", () => ({ requireUser: (...a: unknown[]) => requireUser(...a) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    agentInvocation: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));
vi.mock("@/lib/agents/runtime", () => ({
  runAgent: (...a: unknown[]) => runAgent(...a),
}));
// bootstrap import is a registration side-effect; no-op it in route tests.
vi.mock("@/lib/agents/bootstrap", () => ({}));

import { GET as invocationsGET } from "@/app/api/admin/agents/invocations/route";
import { POST as echoRunPOST } from "@/app/api/admin/agents/echo/run/route";

const admin = { id: "a1", role: "ADMIN", schoolId: "s1", isPlatformAdmin: false };
const student = { id: "s2", role: "STUDENT", schoolId: "s1", isPlatformAdmin: false };

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  }) as never;
}

describe("GET /api/admin/agents/invocations", () => {
  beforeEach(() => {
    requireUser.mockReset();
    findMany.mockReset();
    count.mockReset();
    findMany.mockResolvedValue([{ id: "inv-1", agentName: "echo", status: "SUCCESS" }]);
    count.mockResolvedValue(1);
  });

  it("denies non-admin users with 403", async () => {
    requireUser.mockResolvedValue(student);
    const res = await invocationsGET(req("http://x/api/admin/agents/invocations"));
    expect(res.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns invocations and applies agentName/status filters", async () => {
    requireUser.mockResolvedValue(admin);
    const res = await invocationsGET(
      req("http://x/api/admin/agents/invocations?agentName=echo&status=SUCCESS")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.invocations).toHaveLength(1);
    expect(json.total).toBe(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where.agentName).toBe("echo");
    expect(where.status).toBe("SUCCESS");
  });
});

describe("POST /api/admin/agents/echo/run", () => {
  beforeEach(() => {
    requireUser.mockReset();
    runAgent.mockReset();
    runAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "hi",
      invocationId: "inv-1",
      toolCalls: [],
      llmCostUSD: 0.0002,
    });
  });

  it("denies non-admin users with 403", async () => {
    requireUser.mockResolvedValue(student);
    const res = await echoRunPOST(req("http://x/api/admin/agents/echo/run", { text: "hi" }));
    expect(res.status).toBe(403);
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("runs the echo agent for an admin and returns the result", async () => {
    requireUser.mockResolvedValue(admin);
    const res = await echoRunPOST(req("http://x/api/admin/agents/echo/run", { text: "hi" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("SUCCESS");
    expect(runAgent).toHaveBeenCalledWith(
      "echo",
      "hi",
      expect.objectContaining({ userRole: "admin", userId: "a1" })
    );
  });
});
