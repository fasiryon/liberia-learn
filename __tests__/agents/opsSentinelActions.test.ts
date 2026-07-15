import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const enqueueEscalation = vi.fn();
vi.mock("@/lib/agents/escalation", () => ({
  enqueueEscalation: (...a: unknown[]) => enqueueEscalation(...a),
}));

const invalidateCache = vi.fn();
vi.mock("@/lib/cache/redisCache", () => ({
  invalidateCache: (...a: unknown[]) => invalidateCache(...a),
}));

const sendOpsAlert = vi.fn();
vi.mock("@/lib/ops/alerts", () => ({
  sendOpsAlert: (...a: unknown[]) => sendOpsAlert(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { retryCron, clearOpsCaches, proposeFix } from "@/lib/agents/opsSentinel/actions";
import type { Detection } from "@/lib/agents/opsSentinel/detectors";

const originalFetch = global.fetch;
const originalSecret = process.env.CRON_SECRET;

describe("ops sentinel actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret123";
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.CRON_SECRET = originalSecret;
  });

  describe("retryCron", () => {
    it("re-invokes the cron's own route with the cron secret", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await retryCron("check-dlq");

      expect(result).toEqual({ ok: true, status: 200 });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/cron/check-dlq"),
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer secret123" },
        })
      );
    });

    it("returns ok:false for an unknown cron name", async () => {
      const result = await retryCron("not-a-real-cron");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("no_retry_path_or_secret");
    });

    it("returns ok:false when CRON_SECRET is not set", async () => {
      delete process.env.CRON_SECRET;
      const result = await retryCron("check-dlq");
      expect(result.ok).toBe(false);
    });

    it("returns ok:false when the fetch itself throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
      const result = await retryCron("check-dlq");
      expect(result.ok).toBe(false);
      expect(result.error).toBe("network down");
    });
  });

  describe("clearOpsCaches", () => {
    it("clears the known-safe cache keys", async () => {
      const result = await clearOpsCaches();
      expect(result.cleared).toEqual(["moe:dashboard"]);
      expect(invalidateCache).toHaveBeenCalledWith("moe:dashboard");
    });
  });

  describe("proposeFix", () => {
    const detection: Detection = {
      category: "error_spike",
      detected: true,
      severity: "MEDIUM",
      message: "50 errors",
      details: {},
    };

    it("enqueues an escalation at the detection's severity", async () => {
      enqueueEscalation.mockResolvedValue({ id: "esc-1" });
      const result = await proposeFix(detection);

      expect(result.escalationId).toBe("esc-1");
      expect(enqueueEscalation).toHaveBeenCalledWith(
        expect.objectContaining({ agentName: "ops-sentinel", priority: "MEDIUM" })
      );
      expect(sendOpsAlert).not.toHaveBeenCalled();
    });

    it("also sends an ops alert for HIGH severity", async () => {
      enqueueEscalation.mockResolvedValue({ id: "esc-2" });
      sendOpsAlert.mockResolvedValue({ emailSent: true, smsSent: false });

      await proposeFix({ ...detection, severity: "HIGH" });

      expect(sendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining("HIGH") })
      );
    });

    it("still returns the escalation id if the alert send fails", async () => {
      enqueueEscalation.mockResolvedValue({ id: "esc-3" });
      sendOpsAlert.mockRejectedValue(new Error("smtp down"));

      const result = await proposeFix({ ...detection, severity: "HIGH" });
      expect(result.escalationId).toBe("esc-3");
    });
  });
});
