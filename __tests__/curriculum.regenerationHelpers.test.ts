import { describe, expect, it, vi } from "vitest";

describe("provider retry policy", () => {
  it("retries transient provider failures with exponential policy", async () => {
    const { withProviderRetry } = await import("@/lib/ai/providerRetryPolicy");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce({ ok: true });

    const result = await withProviderRetry(
      { operation: "test", baseDelayMs: 0, jitterMs: 0 },
      operation
    );

    expect(result).toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry quality gate failures", async () => {
    const { withProviderRetry, NonRetryableProviderError } = await import("@/lib/ai/providerRetryPolicy");
    const operation = vi.fn().mockRejectedValue(new NonRetryableProviderError("quality gate failed", "quality_gate_failure"));

    await expect(
      withProviderRetry({ operation: "test", baseDelayMs: 0, jitterMs: 0 }, operation)
    ).rejects.toThrow("quality gate failed");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("DB write throttling", () => {
  it("limits concurrent writes", async () => {
    const { withDbWriteThrottle } = await import("@/lib/db/writeThrottle");
    let active = 0;
    let maxActive = 0;

    await Promise.all([
      withDbWriteThrottle("a", async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      }, { maxConcurrency: 1, delayMs: 0, maxRetries: 1 }),
      withDbWriteThrottle("b", async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        active -= 1;
      }, { maxConcurrency: 1, delayMs: 0, maxRetries: 1 }),
    ]);

    expect(maxActive).toBe(1);
  });

  it("retries idempotent writes on connection reset errors", async () => {
    const { withDbWriteThrottle } = await import("@/lib/db/writeThrottle");
    const write = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("connection reset"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce("ok");

    await expect(withDbWriteThrottle("retry", write, { maxConcurrency: 1, delayMs: 0, maxRetries: 2 })).resolves.toBe("ok");
    expect(write).toHaveBeenCalledTimes(2);
  });
});

describe("adaptive curriculum concurrency", () => {
  it("uses conservative defaults for Grade 3 Science", async () => {
    const { getSubjectConcurrencyProfile } = await import("@/lib/curriculum/adaptiveConcurrency");
    expect(getSubjectConcurrencyProfile("science")).toMatchObject({
      providerConcurrency: 1,
      dbWriteConcurrency: 1,
      batchSize: 5,
    });
  });

  it("reduces concurrency above 20 percent failures and pauses above 40 percent", async () => {
    const { adaptSubjectConcurrency } = await import("@/lib/curriculum/adaptiveConcurrency");
    const current = { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 20 };

    const reduced = adaptSubjectConcurrency({
      subject: "ENGLISH",
      current,
      stats: { attempted: 10, failed: 3 },
    });
    expect(reduced.providerConcurrency).toBe(1);
    expect(reduced.paused).toBeUndefined();

    expect(adaptSubjectConcurrency({
      subject: "ENGLISH",
      current,
      stats: { attempted: 10, failed: 5 },
    })).toMatchObject({ providerConcurrency: 1, batchSize: 5, paused: true });
  });

  it("reduces batch size after timeout or connection reset", async () => {
    const { adaptSubjectConcurrency } = await import("@/lib/curriculum/adaptiveConcurrency");
    expect(adaptSubjectConcurrency({
      subject: "PE",
      current: { providerConcurrency: 2, dbWriteConcurrency: 1, batchSize: 20 },
      stats: { attempted: 10, failed: 1, connectionResets: 1 },
    })).toMatchObject({ providerConcurrency: 2, batchSize: 10 });
  });
});
