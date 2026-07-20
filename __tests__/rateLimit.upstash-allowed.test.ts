import { beforeEach, describe, expect, it, vi } from "vitest";

// Sprint 6.9: regression test for a confirmed production bug where the
// Upstash-backed limiter's `allowed` verdict was derived from `remaining`
// (which the @upstash/ratelimit library clamps at 0) instead of the
// library's own `success` field. That made `allowed` true forever once a
// key hit its limit — verified live against production (7 rapid requests
// against a limit-5 endpoint all returned 200). None of the pre-existing
// rate-limit tests exercised the Upstash backend's blocking logic because
// vitest always forces the memory backend; this test bypasses that via
// `createBackend()`'s explicit runtime overrides, same pattern already used
// by rateLimit.distributed.test.ts's "still supports the Upstash backend" case.

const limitMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(function Redis() {
    return {};
  }),
}));

vi.mock("@upstash/ratelimit", () => {
  function Ratelimit(this: { limit: typeof limitMock }) {
    this.limit = limitMock;
  }
  Ratelimit.slidingWindow = vi.fn(() => ({}));
  return { Ratelimit };
});

describe("UpstashBackend allowed verdict", () => {
  beforeEach(() => {
    limitMock.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  });

  it("honors the library's success:false verdict even though remaining is clamped at 0", async () => {
    const rateLimit = await import("@/lib/rateLimit");
    const backend = rateLimit.createBackend({
      test: false,
      vitest: false,
      build: false,
      production: true,
    });

    limitMock.mockResolvedValueOnce({ success: true, remaining: 0, reset: Date.now() + 60_000 });
    const atLimit = await backend.increment("upstash-allowed:at-limit", 60_000, 5);
    expect(atLimit.allowed).toBe(true);

    limitMock.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 60_000 });
    const overLimit = await backend.increment("upstash-allowed:over-limit", 60_000, 5);
    expect(overLimit.allowed).toBe(false);
  });

  it("would have silently allowed unlimited requests under the old remaining-based logic (documents the bug)", async () => {
    const rateLimit = await import("@/lib/rateLimit");
    const backend = rateLimit.createBackend({
      test: false,
      vitest: false,
      build: false,
      production: true,
    });

    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => backend.increment("upstash-allowed:repeated-block", 60_000, 5))
    );

    for (const result of results) {
      expect(result.allowed).toBe(false);
      expect(result.count).toBe(5); // still clamped, but no longer used to decide allowed
    }
  });
});
