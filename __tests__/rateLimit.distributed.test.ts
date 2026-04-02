import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
describe("distributed rate limit backend selection", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (originalUrl) {
      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    } else {
      delete process.env.UPSTASH_REDIS_REST_URL;
    }

    if (originalToken) {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    } else {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });

  it("uses the memory backend when Upstash env is absent", async () => {
    const rateLimit = await import("@/lib/rateLimit");
    const info = rateLimit.getRateLimiterInfo();

    expect(info).toMatchObject({
      backend: "memory",
      scope: "instance",
      distributedActive: false,
      durable: false,
      configuredSharedStore: false,
    });
  });

  it("memory backend enforces limits and returns standard headers", async () => {
    const rateLimit = await import("@/lib/rateLimit");
    await rateLimit.resetRateLimitStateForTests();

    await rateLimit.checkRateLimit("memory-test", { windowMs: 60_000, limit: 1, namespace: "test" });
    const blocked = await rateLimit.checkRateLimit("memory-test", {
      windowMs: 60_000,
      limit: 1,
      namespace: "test",
    });
    const headers = rateLimit.getRateLimitHeaders(blocked) as Record<string, string>;

    expect(blocked.allowed).toBe(false);
    expect(headers["X-RateLimit-Limit"]).toBe("1");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Reset"]).toBeTruthy();
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(0);
  });

  it("forces the memory backend in test mode even when Upstash env vars are present", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.resetModules();

    const rateLimit = await import("@/lib/rateLimit");
    const info = rateLimit.getRateLimiterInfo();

    expect(info).toMatchObject({
      backend: "memory",
      scope: "instance",
      distributedActive: false,
      durable: false,
      configuredSharedStore: false,
    });
  });

  it("still supports the Upstash backend when runtime context is not test/build", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.resetModules();

    const rateLimit = await import("@/lib/rateLimit");
    const backend = rateLimit.createBackend({
      test: false,
      vitest: false,
      build: false,
      production: true,
    });

    expect(backend.constructor.name).toBe("UpstashBackend");
  });
});
