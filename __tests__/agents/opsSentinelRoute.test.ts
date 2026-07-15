import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agents/bootstrap", () => ({}));

const resolveAgentEnabled = vi.fn();
vi.mock("@/lib/agents/control", () => ({
  resolveAgentEnabled: (...a: unknown[]) => resolveAgentEnabled(...a),
}));

const runOpsSentinelSweep = vi.fn();
vi.mock("@/lib/agents/opsSentinel/sweep", () => ({
  runOpsSentinelSweep: (...a: unknown[]) => runOpsSentinelSweep(...a),
}));

import { GET } from "@/app/api/cron/ops-sentinel/route";

const originalSecret = process.env.CRON_SECRET;
afterAll(() => {
  process.env.CRON_SECRET = originalSecret;
});

function req(auth?: string) {
  return new Request("http://x/api/cron/ops-sentinel", {
    headers: auth ? { authorization: auth } : {},
  }) as never;
}

describe("GET /api/cron/ops-sentinel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret123";
  });

  it("rejects a request without the cron secret", async () => {
    const res = await GET(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(runOpsSentinelSweep).not.toHaveBeenCalled();
  });

  it("skips the sweep when the agent feature flag is off", async () => {
    resolveAgentEnabled.mockResolvedValue(false);
    const res = await GET(req("Bearer secret123"));
    const json = await res.json();

    expect(json.skipped).toBe(true);
    expect(runOpsSentinelSweep).not.toHaveBeenCalled();
  });

  it("runs the sweep when authorized and enabled", async () => {
    resolveAgentEnabled.mockResolvedValue(true);
    runOpsSentinelSweep.mockResolvedValue({ ranAt: "2026-07-15T00:00:00.000Z", items: [] });

    const res = await GET(req("Bearer secret123"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(runOpsSentinelSweep).toHaveBeenCalledTimes(1);
  });
});
