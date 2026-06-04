/**
 * Regression test: concurrent first-loads must join the inflight promise,
 * not get rejected with FALLBACK_LIMIT_EXCEEDED.
 *
 * History: this bug appeared 3 times because the inflight check sat after
 * the concurrency guard. Concurrent request 2 always hit the guard before
 * reaching the inflight join, returning an empty Today page on first load.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRedisCache, FALLBACK_LIMIT_EXCEEDED } from "@/lib/cache/redisCache";

describe("withRedisCache — inflight coalescing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("5 concurrent requests to the same key call fn() exactly once", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const key = `test-inflight-${Date.now()}`;

    const results = await Promise.all(
      Array.from({ length: 5 }, () => withRedisCache(key, 60, fn))
    );

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["result", "result", "result", "result", "result"]);
  });

  it("concurrent requests do NOT throw FALLBACK_LIMIT_EXCEEDED for the same key", async () => {
    let resolveFn!: (v: string) => void;
    const slowFn = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => { resolveFn = resolve; })
    );
    const key = `test-inflight-race-${Date.now()}`;

    // Fire 3 requests before the first one resolves
    const pending = Promise.allSettled([
      withRedisCache(key, 60, slowFn),
      withRedisCache(key, 60, slowFn),
      withRedisCache(key, 60, slowFn),
    ]);

    // Let the first request start its fallback, then resolve it
    await Promise.resolve();
    resolveFn("data");

    const results = await pending;

    // None of the requests should have been rejected
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.code);

    expect(errors).not.toContain(FALLBACK_LIMIT_EXCEEDED);
    expect(slowFn).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
  });

  it("DIFFERENT keys: second key is rejected when fallback slot is taken", async () => {
    // key2 must be fired while key1 is in-flight (not yet resolved)
    let resolveKey1!: (v: string) => void;
    const key1Fn = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => { resolveKey1 = resolve; })
    );
    const key2Fn = vi.fn().mockResolvedValue("key2-result");

    const key1 = `test-diff-a-${Date.now()}`;
    const key2 = `test-diff-b-${Date.now()}`;

    // Start key1 (takes the slot) but don't await it yet
    const p1 = withRedisCache(key1, 60, key1Fn);

    // key2 fires while key1's fallback is running → should be rejected
    const p2Result = await withRedisCache(key2, 60, key2Fn).catch((e) => e);

    // Now let key1 finish
    resolveKey1("key1-result");
    await p1;

    expect((p2Result as any)?.code).toBe(FALLBACK_LIMIT_EXCEEDED);
    expect(key2Fn).not.toHaveBeenCalled();
  });
});
