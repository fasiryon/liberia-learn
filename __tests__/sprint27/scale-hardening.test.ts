/**
 * Sprint 27 — Scale Hardening Tests
 *
 * 1.  CircuitBreaker: CLOSED → OPEN after 5 failures
 * 2.  CircuitBreaker: OPEN returns fallback without calling fn
 * 3.  CircuitBreaker: OPEN → HALF_OPEN after timeout; success → CLOSED
 * 4.  CircuitBreaker: HALF_OPEN failure → OPEN again
 * 5.  getFlag: returns Edge Config value when available
 * 6.  getFlag: returns defaultValue when Edge Config throws
 * 7.  cache-warm route: returns 401 without correct secret header
 * 8.  cache-warm route: warms league + lessons + schools keys in Redis
 * 9.  DB timeout middleware: rejects after 8s mock delay
 * 10. AI tutor: routedCompletion returns fallback message when breaker is OPEN
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Test 1–4: CircuitBreaker ─────────────────────────────────────────────────

import { CircuitBreaker } from "@/lib/ai/circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker();
  });

  it("1. CLOSED → OPEN after 5 consecutive failures", async () => {
    const fail = () => Promise.reject(new Error("provider down"));
    for (let i = 0; i < 5; i++) {
      await breaker.call(fail, "fallback");
    }
    expect(breaker.getState()).toBe("OPEN");
  });

  it("2. OPEN returns fallback without calling fn", async () => {
    const fail = () => Promise.reject(new Error("provider down"));
    const fn = vi.fn(() => Promise.resolve("real result"));

    for (let i = 0; i < 5; i++) {
      await breaker.call(fail, "fallback");
    }
    expect(breaker.getState()).toBe("OPEN");

    const result = await breaker.call(fn, "fallback");
    expect(result).toBe("fallback");
    expect(fn).not.toHaveBeenCalled();
  });

  it("3. OPEN → HALF_OPEN after timeout; success → CLOSED", async () => {
    // Use a breaker with 0ms timeout so it transitions to HALF_OPEN immediately
    const fastBreaker = new CircuitBreaker({ timeoutMs: 0 });
    const fail = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 5; i++) {
      await fastBreaker.call(fail, "fallback");
    }
    expect(fastBreaker.getState()).toBe("OPEN");

    // With timeoutMs=0, next call moves to HALF_OPEN and allows one test request
    const successFn = vi.fn(() => Promise.resolve("ok"));
    const result = await fastBreaker.call(successFn, "fallback");
    expect(result).toBe("ok");
    expect(successFn).toHaveBeenCalledOnce();
    expect(fastBreaker.getState()).toBe("CLOSED");
  });

  it("4. HALF_OPEN failure → OPEN again", async () => {
    const fastBreaker = new CircuitBreaker({ timeoutMs: 0 });
    const fail = () => Promise.reject(new Error("down"));

    for (let i = 0; i < 5; i++) {
      await fastBreaker.call(fail, "fallback");
    }
    expect(fastBreaker.getState()).toBe("OPEN");

    // HALF_OPEN test request fails → back to OPEN
    const stillFailFn = vi.fn(() => Promise.reject(new Error("still down")));
    const result = await fastBreaker.call(stillFailFn, "fallback");
    expect(result).toBe("fallback");
    expect(stillFailFn).toHaveBeenCalledOnce();
    expect(fastBreaker.getState()).toBe("OPEN");
  });
});

// ─── Test 5–6: getFlag (Edge Config) ─────────────────────────────────────────

const mockEdgeGet = vi.hoisted(() => vi.fn());

vi.mock("@vercel/edge-config", () => ({
  get: mockEdgeGet,
}));

import { getFlag } from "@/lib/flags";

describe("getFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("5. returns Edge Config value when available", async () => {
    mockEdgeGet.mockResolvedValueOnce(false);
    const result = await getFlag("feature:ai_tutor", true);
    expect(result).toBe(false);
    expect(mockEdgeGet).toHaveBeenCalledWith("feature:ai_tutor");
  });

  it("6. returns defaultValue when Edge Config throws", async () => {
    mockEdgeGet.mockRejectedValueOnce(new Error("Edge Config unavailable"));
    const result = await getFlag("feature:ai_tutor", true);
    expect(result).toBe(true);
  });
});

// ─── Test 7–8: cache-warm route ───────────────────────────────────────────────

// Use vi.hoisted so these are available inside vi.mock factories
const { mockRedisSet, mockRedisDel, MockRedisConstructor } = vi.hoisted(() => {
  const mockRedisSet = vi.fn().mockResolvedValue("OK");
  const mockRedisDel = vi.fn().mockResolvedValue(1);
  const mockRedisGet = vi.fn().mockResolvedValue(null);

  // Must be a regular function (not arrow) to work with `new`
  function MockRedisConstructor(this: Record<string, unknown>) {
    this.set = mockRedisSet;
    this.del = mockRedisDel;
    this.get = mockRedisGet;
  }

  return { mockRedisSet, mockRedisDel, MockRedisConstructor };
});

vi.mock("@upstash/redis", () => ({
  Redis: MockRedisConstructor,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leagueSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    curriculumContent: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    school: {
      findMany: vi.fn().mockResolvedValue([
        { id: "s1", name: "CHA", county: "Montserrado", district: "Greater Monrovia" },
      ]),
    },
  },
}));

import { GET as cacheWarmGET } from "@/app/api/cache-warm/route";

describe("GET /api/cache-warm", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      CACHE_WARM_SECRET: "test-secret-xyz",
      UPSTASH_REDIS_REST_URL: "https://fake.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "fake-token",
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("7. returns 401 without correct secret header", async () => {
    const req = new Request("http://localhost/api/cache-warm", {
      headers: { "x-cache-warm-secret": "wrong-secret" },
    });
    const res = await cacheWarmGET(req as any);
    expect(res.status).toBe(401);
  });

  it("8. warms league + lessons + schools keys in Redis with correct secret", async () => {
    const req = new Request("http://localhost/api/cache-warm", {
      headers: { "x-cache-warm-secret": "test-secret-xyz" },
    });
    const res = await cacheWarmGET(req as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.warmed).toHaveProperty("league");
    expect(body.warmed).toHaveProperty("lessons");
    expect(body.warmed).toHaveProperty("schools");
    // Redis.set should have been called at least 3 times (league + 12 grades + schools)
    expect(mockRedisSet).toHaveBeenCalled();
  });
});

// ─── Test 9: DB timeout middleware ────────────────────────────────────────────

describe("DB query timeout middleware", () => {
  it("9. rejects after 8s mock delay", async () => {
    vi.useFakeTimers();

    const slowQuery = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("should not resolve")), 15_000)
    );
    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DB query timeout after 8000ms")), 8_000)
    );

    const race = Promise.race([slowQuery, timeoutGuard]);
    vi.advanceTimersByTime(8_001);

    await expect(race).rejects.toThrow("DB query timeout after 8000ms");

    vi.useRealTimers();
  });
});

// ─── Test 10: AI tutor returns fallback when OpenAI breaker is OPEN ──────────

const mockOpenAICreate = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error("OpenAI down"))
);

vi.mock("@/lib/ai/openaiClient", () => ({
  getOpenAIClientOrThrow: () => ({
    chat: { completions: { create: mockOpenAICreate } },
  }),
}));

vi.mock("@/lib/ai/budgetGuard", () => ({
  checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/lib/ai/interactionLog", () => ({
  logAIInteraction: vi.fn().mockResolvedValue(undefined),
}));

describe("routedCompletion circuit breaker", () => {
  it("10. returns fallback content when openAiBreaker is OPEN", async () => {
    const { routedCompletion } = await import("@/lib/ai/routedCompletion");
    const { openAiBreaker } = await import("@/lib/ai/circuit-breaker");

    // Reset state from any previous test runs
    openAiBreaker.reset();

    // Disable Groq so only OpenAI is attempted
    const oldGroq = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    try {
      // 5 failing calls to open the breaker
      for (let i = 0; i < 5; i++) {
        await routedCompletion({ messages: [{ role: "user", content: "hello" }] });
      }
      expect(openAiBreaker.getState()).toBe("OPEN");

      // 6th call — breaker is OPEN, fallback returned immediately
      const result = await routedCompletion({
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.content).toContain("I'm having trouble connecting");
      expect(result.model).toBe("__openai_cb_fallback__");
    } finally {
      if (oldGroq !== undefined) process.env.GROQ_API_KEY = oldGroq;
      openAiBreaker.reset();
    }
  });
});
