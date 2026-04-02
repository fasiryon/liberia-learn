import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimiterInfo,
  RATE_LIMIT_POLICIES,
  resetRateLimitStateForTests,
} from "@/lib/rateLimit";

describe("checkRateLimit - invite route protection", () => {
  beforeEach(async () => {
    await resetRateLimitStateForTests();
  });

  it("allows the first request", async () => {
    const key = `test:first:${Math.random()}`;
    const result = await checkRateLimit(key, { windowMs: 60_000, limit: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows up to limit requests within the window", async () => {
    const key = `test:max:${Math.random()}`;
    const opts = { windowMs: 60_000, limit: 3 };

    const r1 = await checkRateLimit(key, opts);
    const r2 = await checkRateLimit(key, opts);
    const r3 = await checkRateLimit(key, opts);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks the next request after the limit is exhausted", async () => {
    const key = `test:block:${Math.random()}`;
    const opts = { windowMs: 60_000, limit: 2 };

    await checkRateLimit(key, opts);
    await checkRateLimit(key, opts);

    const blocked = await checkRateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns remaining count that decrements correctly", async () => {
    const key = `test:remaining:${Math.random()}`;
    const opts = { windowMs: 60_000, limit: 5 };

    await checkRateLimit(key, opts);
    const second = await checkRateLimit(key, opts);
    expect(second.remaining).toBe(3);

    await checkRateLimit(key, opts);
    await checkRateLimit(key, opts);
    const fifth = await checkRateLimit(key, opts);
    expect(fifth.remaining).toBe(0);
    expect(fifth.allowed).toBe(true);
  });

  it("blocked calls keep resetAt in the future", async () => {
    const key = `test:future:${Math.random()}`;
    const opts = { windowMs: 60_000, limit: 1 };

    await checkRateLimit(key, opts);
    const blocked = await checkRateLimit(key, opts);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests again after the window expires", async () => {
    const key = `test:window:${Math.random()}`;
    const opts = { windowMs: 50, limit: 1 };

    await checkRateLimit(key, opts);
    expect((await checkRateLimit(key, opts)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 70));

    expect((await checkRateLimit(key, opts)).allowed).toBe(true);
  });

  it("tracks different keys independently", async () => {
    const opts = { windowMs: 60_000, limit: 1 };
    const key1 = `test:independent:${Math.random()}`;
    const key2 = `test:independent:${Math.random()}`;

    await checkRateLimit(key1, opts);
    expect((await checkRateLimit(key1, opts)).allowed).toBe(false);
    expect((await checkRateLimit(key2, opts)).allowed).toBe(true);
  });
});

describe("checkRateLimit - configured limits match invite routes", () => {
  beforeEach(async () => {
    await resetRateLimitStateForTests();
  });

  it("invite policy allows 20 calls and blocks the 21st", async () => {
    const key = `invite:ip:${Math.random()}`;
    const opts = {
      windowMs: RATE_LIMIT_POLICIES.INVITES.windowMs,
      limit: RATE_LIMIT_POLICIES.INVITES.limit,
    };

    for (let i = 0; i < RATE_LIMIT_POLICIES.INVITES.limit; i += 1) {
      expect((await checkRateLimit(key, opts)).allowed).toBe(true);
    }
    expect((await checkRateLimit(key, opts)).allowed).toBe(false);
  });

  it("exposes the active backend honestly as memory fallback without Upstash env", () => {
    expect(getRateLimiterInfo()).toMatchObject({
      backend: "memory",
      scope: "instance",
      durable: false,
      configuredSharedStore: false,
      distributedActive: false,
    });
  });

  it("returns rate-limit headers for operators and clients", async () => {
    const key = `invite:headers:${Math.random()}`;
    const opts = { windowMs: 60_000, limit: 1 };

    await checkRateLimit(key, opts);
    const blocked = await checkRateLimit(key, opts);
    const headers = getRateLimitHeaders(blocked) as Record<string, string>;

    expect(headers["X-RateLimit-Limit"]).toBe("1");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Reset"]).toBeTruthy();
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(0);
  });
});
