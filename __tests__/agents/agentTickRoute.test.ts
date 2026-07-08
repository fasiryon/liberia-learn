import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const tickGoals = vi.fn();
vi.mock("@/lib/agents/goals/tick", () => ({
  tickGoals: (...a: unknown[]) => tickGoals(...a),
}));
// bootstrap registers goal handlers as a side effect; no-op it here.
vi.mock("@/lib/agents/bootstrap", () => ({}));

import { GET } from "@/app/api/cron/agents/tick/route";

const originalSecret = process.env.CRON_SECRET;
const originalFlag = process.env.AGENT_CRON_ENABLED;
afterAll(() => {
  process.env.CRON_SECRET = originalSecret;
  process.env.AGENT_CRON_ENABLED = originalFlag;
});

function req(auth?: string) {
  return new Request("http://x/api/cron/agents/tick", {
    headers: auth ? { authorization: auth } : {},
  }) as never;
}

describe("GET /api/cron/agents/tick", () => {
  beforeEach(() => {
    tickGoals.mockReset();
    tickGoals.mockResolvedValue({ scanned: 2, advanced: 2, failed: 0, results: [] });
    process.env.CRON_SECRET = "secret123";
    process.env.AGENT_CRON_ENABLED = "true";
  });

  it("rejects a request without the cron secret", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(tickGoals).not.toHaveBeenCalled();
  });

  it("skips when the agent cron flag is off", async () => {
    process.env.AGENT_CRON_ENABLED = "false";
    const res = await GET(req("Bearer secret123"));
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(tickGoals).not.toHaveBeenCalled();
  });

  it("runs the goal tick when authorized and enabled", async () => {
    const res = await GET(req("Bearer secret123"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.advanced).toBe(2);
    expect(tickGoals).toHaveBeenCalledTimes(1);
  });
});
