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

  it("DIFFERENT keys: (MAX_CONCURRENT_DB_FALLBACKS+1)th key is rejected once all slots are taken", async () => {
    // MAX_CONCURRENT_DB_FALLBACKS = 3 (lib/cache/redisCache.ts). Fill all 3
    // slots with distinct in-flight keys, then confirm a 4th distinct key is
    // rejected while they're still pending, and succeeds once one frees up.
    const SLOTS = 3;
    const resolvers: Array<(v: string) => void> = [];
    const fns = Array.from({ length: SLOTS }, (_, i) =>
      vi.fn().mockReturnValue(
        new Promise<string>((resolve) => { resolvers[i] = resolve; })
      )
    );
    const overflowFn = vi.fn().mockResolvedValue("overflow-result");

    const prefix = `test-diff-${Date.now()}`;
    const keys = Array.from({ length: SLOTS }, (_, i) => `${prefix}-${i}`);
    const overflowKey = `${prefix}-overflow`;

    // Take all SLOTS fallback slots with distinct pending keys.
    const pendings = keys.map((key, i) => withRedisCache(key, 60, fns[i]));

    // One more distinct key while all slots are taken → should be rejected.
    const overflowResult = await withRedisCache(overflowKey, 60, overflowFn).catch((e) => e);
    expect((overflowResult as any)?.code).toBe(FALLBACK_LIMIT_EXCEEDED);
    expect(overflowFn).not.toHaveBeenCalled();

    // Free one slot, then the same key should now succeed.
    resolvers[0]("result-0");
    await pendings[0];
    const afterFreeResult = await withRedisCache(overflowKey, 60, overflowFn);
    expect(afterFreeResult).toBe("overflow-result");
    expect(overflowFn).toHaveBeenCalledTimes(1);

    // Clean up remaining slots.
    resolvers[1]("result-1");
    resolvers[2]("result-2");
    await Promise.all(pendings.slice(1));
  });
});
