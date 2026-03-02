/**
 * __tests__/rateLimit.invites.test.ts
 *
 * Verifies that checkRateLimit behaves correctly for invite / auth routes.
 * These tests use the in-memory checkRateLimit implementation directly.
 * Each test uses a unique random key to avoid state leakage between tests.
 */

import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

// ─── Unit tests for checkRateLimit ───────────────────────────────────────────

describe("checkRateLimit — invite route protection", () => {
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

    checkRateLimit(key, opts); // 1
    checkRateLimit(key, opts); // 2

    const blocked = checkRateLimit(key, opts); // 3 — over limit
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("returns remaining count that decrements correctly", () => {
    const key = `test:remaining:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 5 };

    checkRateLimit(key, opts); // 1 used → remaining 4
    const second = checkRateLimit(key, opts); // 2 used → remaining 3
    expect(second.remaining).toBe(3);

    checkRateLimit(key, opts); // 3 used → remaining 2
    checkRateLimit(key, opts); // 4 used → remaining 1
    const fifth = checkRateLimit(key, opts); // 5 used → remaining 0
    expect(fifth.remaining).toBe(0);
    expect(fifth.allowed).toBe(true);
  });

  it("blocks call returns remaining=0 and resetAt in the future", () => {
    const key = `test:future:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 1 };

    checkRateLimit(key, opts); // at max
    const blocked = checkRateLimit(key, opts);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows requests again after the window expires", async () => {
    const key = `test:window:${Math.random()}`;
    const opts = { windowMs: 50, max: 1 }; // 50 ms window

    checkRateLimit(key, opts); // 1 — at max
    expect(checkRateLimit(key, opts).allowed).toBe(false); // blocked

    await new Promise((r) => setTimeout(r, 70)); // wait past window

    expect(checkRateLimit(key, opts).allowed).toBe(true); // window reset
  });

  it("tracks different keys independently", () => {
    const opts = { windowMs: 60_000, max: 1 };
    const key1 = `test:independent:${Math.random()}`;
    const key2 = `test:independent:${Math.random()}`;

    checkRateLimit(key1, opts); // key1 at max
    expect(checkRateLimit(key1, opts).allowed).toBe(false); // key1 blocked
    expect(checkRateLimit(key2, opts).allowed).toBe(true);  // key2 untouched
  });
});

// ─── Invite-route-specific limit scenarios ────────────────────────────────────

describe("checkRateLimit — configured limits match invite routes", () => {
  it("IP limit of 20/hour allows 20 calls and blocks the 21st", () => {
    const key = `invite:ip:${Math.random()}`;
    const opts = { windowMs: 60 * 60 * 1000, max: 20 };

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(key, opts).allowed).toBe(true);
    }
    expect(checkRateLimit(key, opts).allowed).toBe(false);
  });
});
