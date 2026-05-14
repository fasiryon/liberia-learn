import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export interface RateLimitBackend {
  increment(key: string, windowMs: number, limit: number): Promise<number>;
  remaining(key: string, limit: number): Promise<number>;
  reset(key: string): Promise<void>;
}

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  namespace?: string;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  retryAfter: number;
  backend: "memory" | "upstash";
  scope: "instance" | "distributed";
  namespace: string;
};

export const RATE_LIMIT_POLICIES = {
  AI_HEAVY: { windowMs: 3_600_000, student: 20, teacher: 50, admin: 100 },
  AUTH: { windowMs: 900_000, limit: 5 },
  ADMIN: { windowMs: 3_600_000, limit: 200 },
  INVITES: { windowMs: 3_600_000, limit: 20 },
  LEGACY_AI_CHAT: { windowMs: 60_000, limit: 20 },
} as const;

type BackendDescriptor = {
  kind: "memory" | "upstash";
  scope: "instance" | "distributed";
  distributedActive: boolean;
};

type RateLimitRuntimeContext = {
  test: boolean;
  build: boolean;
  production: boolean;
  vitest: boolean;
};

const memoryWarning = "[RateLimit] WARNING: Using in-memory limiter (NOT production-safe)";
let didWarnAboutMemory = false;
let cachedBackend: RateLimitBackend | null = null;
let cachedBackendSignature: string | null = null;

function isVitestEnvironment() {
  return Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID);
}

function isTestEnvironment() {
  return process.env.NODE_ENV === "test" || isVitestEnvironment();
}

function isBuildPhase() {
  if (process.env.NEXT_PHASE) return true;
  if (process.env.npm_lifecycle_event === "build") return true;

  const argv = process.argv.join(" ").toLowerCase();
  return argv.includes("next build");
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function hasUpstashEnv() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getRuntimeContext(overrides?: Partial<RateLimitRuntimeContext>): RateLimitRuntimeContext {
  return {
    test: overrides?.test ?? isTestEnvironment(),
    build: overrides?.build ?? isBuildPhase(),
    production: overrides?.production ?? isProductionEnvironment(),
    vitest: overrides?.vitest ?? isVitestEnvironment(),
  };
}

function currentBackendSignature() {
  const runtime = getRuntimeContext();
  return JSON.stringify({
    test: runtime.test,
    build: runtime.build,
    production: runtime.production,
    vitest: runtime.vitest,
    upstashConfigured: hasUpstashEnv(),
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });
}

function warnMemoryOnce() {
  if (didWarnAboutMemory) return;
  if (isTestEnvironment() || isBuildPhase()) return;
  didWarnAboutMemory = true;
  console.warn(memoryWarning);
}

function durationFromWindowMs(windowMs: number) {
  if (windowMs % 3_600_000 === 0) return `${windowMs / 3_600_000} h`;
  if (windowMs % 60_000 === 0) return `${windowMs / 60_000} m`;
  if (windowMs % 1_000 === 0) return `${windowMs / 1_000} s`;
  return `${windowMs} ms`;
}

class MemoryBackend implements RateLimitBackend {
  private readonly state = new Map<string, RateLimitState>();

  constructor() {
    warnMemoryOnce();
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const current = this.state.get(key);

    if (!current || now > current.resetAt) {
      this.state.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }

    current.count += 1;
    return current.count;
  }

  async remaining(key: string, limit: number): Promise<number> {
    const current = this.state.get(key);
    if (!current || Date.now() > current.resetAt) {
      return limit;
    }

    return Math.max(0, limit - current.count);
  }

  async reset(key: string): Promise<void> {
    this.state.delete(key);
  }

  getResetAt(key: string, windowMs: number) {
    const current = this.state.get(key);
    if (!current || Date.now() > current.resetAt) {
      return Date.now() + windowMs;
    }

    return current.resetAt;
  }

  resetAll() {
    this.state.clear();
  }
}

class UpstashBackend implements RateLimitBackend {
  private redis: Redis | null = null;
  private readonly limiters = new Map<string, Ratelimit>();
  private readonly lastResults = new Map<string, { remaining: number; resetAt: number; count: number }>();

  private getRedis() {
    if (this.redis) {
      return this.redis;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      throw new Error("Upstash Redis env vars missing");
    }

    this.redis = new Redis({ url, token });
    return this.redis;
  }

  private getLimiter(windowMs: number, limit: number) {
    const cacheKey = `${limit}:${windowMs}`;
    const existing = this.limiters.get(cacheKey);
    if (existing) {
      return existing;
    }

    const limiter = new Ratelimit({
      redis: this.getRedis(),
      limiter: Ratelimit.slidingWindow(limit, durationFromWindowMs(windowMs) as any),
      analytics: false,
      prefix: "liberialearn:rate-limit",
    });
    this.limiters.set(cacheKey, limiter);
    return limiter;
  }

  async increment(key: string, windowMs: number, limit: number): Promise<number> {
    const result = await this.getLimiter(windowMs, limit).limit(key);
    const count = Math.max(0, limit - result.remaining);

    this.lastResults.set(key, {
      remaining: result.remaining,
      resetAt: typeof result.reset === "number" ? result.reset : Date.now() + windowMs,
      count,
    });

    return count;
  }

  async remaining(key: string, limit: number): Promise<number> {
    return this.lastResults.get(key)?.remaining ?? limit;
  }

  async reset(key: string): Promise<void> {
    this.lastResults.delete(key);
  }

  getResetAt(key: string, windowMs: number) {
    return this.lastResults.get(key)?.resetAt ?? Date.now() + windowMs;
  }
}

export function createBackend(runtimeOverrides?: Partial<RateLimitRuntimeContext>): RateLimitBackend {
  const runtime = getRuntimeContext(runtimeOverrides);

  if (runtime.test || runtime.vitest || runtime.build) {
    return new MemoryBackend();
  }

  if (hasUpstashEnv()) {
    return new UpstashBackend();
  }

  return new MemoryBackend();
}

function getRateLimitBackend() {
  const signature = currentBackendSignature();
  if (!cachedBackend || cachedBackendSignature !== signature) {
    cachedBackend = createBackend();
    cachedBackendSignature = signature;
  }

  return cachedBackend;
}

function getBackendDescriptor(backend: RateLimitBackend): BackendDescriptor {
  if (backend instanceof UpstashBackend) {
    return {
      kind: "upstash",
      scope: "distributed",
      distributedActive: true,
    };
  }

  return {
    kind: "memory",
    scope: "instance",
    distributedActive: false,
  };
}

function getResetAtForKey(backend: RateLimitBackend, key: string, windowMs: number) {
  if (backend instanceof UpstashBackend) {
    return backend.getResetAt(key, windowMs);
  }
  if (backend instanceof MemoryBackend) {
    return backend.getResetAt(key, windowMs);
  }
  return Date.now() + windowMs;
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const backend = getRateLimitBackend();
  const namespace = options.namespace?.trim() || "global";
  const namespacedKey = `${namespace}:${key}`;
  const count = await backend.increment(namespacedKey, options.windowMs, options.limit);
  const remaining = await backend.remaining(namespacedKey, options.limit);
  const resetAt = getResetAtForKey(backend, namespacedKey, options.windowMs);
  const descriptor = getBackendDescriptor(backend);
  const allowed = count <= options.limit;
  const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    allowed,
    remaining,
    resetAt,
    limit: options.limit,
    retryAfter,
    backend: descriptor.kind,
    scope: descriptor.scope,
    namespace,
  };
}

export function getRateLimiterInfo() {
  const backend = getRateLimitBackend();
  const descriptor = getBackendDescriptor(backend);
  return {
    backend: descriptor.kind,
    scope: descriptor.scope,
    durable: descriptor.distributedActive,
    configuredSharedStore: descriptor.distributedActive,
    distributedActive: descriptor.distributedActive,
    environment: {
      test: isTestEnvironment(),
      build: isBuildPhase(),
      production: isProductionEnvironment(),
    },
  } as const;
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(result.retryAfter),
  };
}

export function rateLimitExceededResponse(result: RateLimitResult) {
  return NextResponse.json(
    {
      error: "Too many requests",
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  );
}

export async function resetRateLimitStateForTests(): Promise<void> {
  if (!isTestEnvironment()) {
    return;
  }

  const backend = getRateLimitBackend();
  if (backend instanceof MemoryBackend) {
    backend.resetAll();
  }

  cachedBackend = null;
  cachedBackendSignature = null;
}
