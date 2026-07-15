import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Detection } from "@/lib/agents/opsSentinel/detectors";

const runAllDetectors = vi.fn();
vi.mock("@/lib/agents/opsSentinel/detectors", () => ({
  runAllDetectors: (...a: unknown[]) => runAllDetectors(...a),
}));

const retryCron = vi.fn();
const proposeFix = vi.fn();
vi.mock("@/lib/agents/opsSentinel/actions", () => ({
  retryCron: (...a: unknown[]) => retryCron(...a),
  proposeFix: (...a: unknown[]) => proposeFix(...a),
}));

import { runOpsSentinelSweep } from "@/lib/agents/opsSentinel/sweep";

function detection(overrides: Partial<Detection>): Detection {
  return {
    category: "error_spike",
    detected: false,
    severity: "MEDIUM",
    message: "ok",
    details: {},
    ...overrides,
  };
}

describe("runOpsSentinelSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records action:none for undetected categories", async () => {
    runAllDetectors.mockResolvedValue([
      detection({ category: "migration_drift", detected: false }),
    ]);

    const result = await runOpsSentinelSweep();

    expect(result.items).toEqual([
      { category: "migration_drift", detected: false, tier: null, action: "none", detail: "ok" },
    ]);
    expect(proposeFix).not.toHaveBeenCalled();
  });

  it("auto-fixes a cron miss when the retry succeeds (tier 1)", async () => {
    runAllDetectors.mockResolvedValue([
      detection({
        category: "cron_miss",
        detected: true,
        details: { statuses: [{ name: "check-dlq", missed: true }] },
      }),
    ]);
    retryCron.mockResolvedValue({ ok: true, status: 200 });

    const result = await runOpsSentinelSweep();

    expect(retryCron).toHaveBeenCalledWith("check-dlq");
    expect(result.items[0]).toMatchObject({ tier: 1, action: "auto_fixed" });
    expect(proposeFix).not.toHaveBeenCalled();
  });

  it("escalates a cron miss when the retry fails (tier 2)", async () => {
    runAllDetectors.mockResolvedValue([
      detection({
        category: "cron_miss",
        detected: true,
        details: { statuses: [{ name: "check-dlq", missed: true }] },
      }),
    ]);
    retryCron.mockResolvedValue({ ok: false, error: "boom" });
    proposeFix.mockResolvedValue({ escalationId: "esc-1" });

    const result = await runOpsSentinelSweep();

    expect(proposeFix).toHaveBeenCalledTimes(1);
    expect(result.items[0]).toMatchObject({ tier: 2, action: "escalated" });
  });

  it("always escalates migration_drift, error_spike, and cost_cap_breach (never auto-fixed)", async () => {
    runAllDetectors.mockResolvedValue([
      detection({ category: "migration_drift", detected: true, severity: "HIGH" }),
      detection({ category: "error_spike", detected: true }),
      detection({ category: "cost_cap_breach", detected: true }),
    ]);
    proposeFix.mockResolvedValue({ escalationId: "esc-2" });

    const result = await runOpsSentinelSweep();

    expect(proposeFix).toHaveBeenCalledTimes(3);
    expect(retryCron).not.toHaveBeenCalled();
    for (const item of result.items) {
      expect(item.tier).toBe(2);
      expect(item.action).toBe("escalated");
    }
  });
});
