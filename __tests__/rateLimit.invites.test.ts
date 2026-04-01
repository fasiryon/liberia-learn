/**
 * __tests__/rateLimit.invites.test.ts
 *
 * Verifies that checkRateLimit behaves correctly for invite / auth routes.
 * These tests use the shared rate limiter abstraction directly.
 */

import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  getRateLimiterInfo,
} from "@/lib/rateLimit";

describe("checkRateLimit - invite route protection", () => {
  it("allows the first request", () => {
    const key = `test:first:${Math.random()}`;
    const result = checkRateLimit(key, { windowMs: 60_000, max: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows up to max requests within the window", () => {
    const key = `test:max:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 3 };

    const r1 = checkRateLimit(key, opts);
    const r2 = checkRateLimit(key, opts);
    const r3 = checkRateLimit(key, opts);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks the (max + 1)th request", () => {
    const key = `test:block:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 2 };

    checkRateLimit(key, opts);
    checkRateLimit(key, opts);

    const blocked = checkRateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns remaining count that decrements correctly", () => {
    const key = `test:remaining:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 5 };

    checkRateLimit(key, opts);
    const second = checkRateLimit(key, opts);
    expect(second.remaining).toBe(3);

    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const fifth = checkRateLimit(key, opts);
    expect(fifth.remaining).toBe(0);
    expect(fifth.allowed).toBe(true);
  });

  it("blocked calls keep resetAt in the future", () => {
    const key = `test:future:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 1 };

    checkRateLimit(key, opts);
    const blocked = checkRateLimit(key, opts);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests again after the window expires", async () => {
    const key = `test:window:${Math.random()}`;
    const opts = { windowMs: 50, max: 1 };

    checkRateLimit(key, opts);
    expect(checkRateLimit(key, opts).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 70));

    expect(checkRateLimit(key, opts).allowed).toBe(true);
  });

  it("tracks different keys independently", () => {
    const opts = { windowMs: 60_000, max: 1 };
    const key1 = `test:independent:${Math.random()}`;
    const key2 = `test:independent:${Math.random()}`;

    checkRateLimit(key1, opts);
    expect(checkRateLimit(key1, opts).allowed).toBe(false);
    expect(checkRateLimit(key2, opts).allowed).toBe(true);
  });
});

describe("checkRateLimit - configured limits match invite routes", () => {
  it("IP limit of 20/hour allows 20 calls and blocks the 21st", () => {
    const key = `invite:ip:${Math.random()}`;
    const opts = { windowMs: 60 * 60 * 1000, max: 20 };

    for (let i = 0; i < 20; i += 1) {
      expect(checkRateLimit(key, opts).allowed).toBe(true);
    }
    expect(checkRateLimit(key, opts).allowed).toBe(false);
  });

  it("exposes the active backend honestly as instance-local memory fallback", () => {
    expect(getRateLimiterInfo()).toMatchObject({
      backend: "memory",
      scope: "instance",
      durable: false,
      configuredSharedStore: false,
    });
  });

  it("returns rate-limit headers for operators and clients", () => {
    const key = `invite:headers:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 1 };

    checkRateLimit(key, opts);
    const blocked = checkRateLimit(key, opts);
    const headers = getRateLimitHeaders(blocked) as Record<string, string>;

    expect(headers["X-RateLimit-Limit"]).toBe("1");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Backend"]).toBe("memory");
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(0);
  });
});
