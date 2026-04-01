export type RateLimitOptions = {
  windowMs: number;
  max: number;
  namespace?: string;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

type RateLimitStoreResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export type RateLimitResult = RateLimitStoreResult & {
  backend: "memory";
  scope: "instance";
  namespace: string;
};

export interface RateLimitStore {
  readonly backend: "memory";
  readonly scope: "instance";
  consume(key: string, options: RateLimitOptions): RateLimitStoreResult;
  reset(): void;
}

class InMemoryRateLimitStore implements RateLimitStore {
  readonly backend = "memory" as const;
  readonly scope = "instance" as const;
  private readonly state = new Map<string, RateLimitState>();

  consume(key: string, options: RateLimitOptions): RateLimitStoreResult {
    const now = Date.now();
    const current = this.state.get(key);

    if (!current || now > current.resetAt) {
      const resetAt = now + options.windowMs;
      this.state.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: options.max - 1, resetAt, limit: options.max };
    }

    if (current.count >= options.max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
        limit: options.max,
      };
    }

    current.count += 1;
    this.state.set(key, current);
    return {
      allowed: true,
      remaining: options.max - current.count,
      resetAt: current.resetAt,
      limit: options.max,
    };
  }

  reset(): void {
    this.state.clear();
  }
}

class RateLimiter {
  constructor(private readonly store: RateLimitStore) {}

  check(key: string, options: RateLimitOptions): RateLimitResult {
    const namespace = options.namespace?.trim() || "global";
    const namespacedKey = `${namespace}:${key}`;
    const result = this.store.consume(namespacedKey, options);

    return {
      ...result,
      backend: this.store.backend,
      scope: this.store.scope,
      namespace,
    };
  }

  describe() {
    return {
      backend: this.store.backend,
      scope: this.store.scope,
      durable: false,
      configuredSharedStore: false,
    } as const;
  }

  reset(): void {
    this.store.reset();
  }
}

const fallbackRateLimiter = new RateLimiter(new InMemoryRateLimitStore());

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  return fallbackRateLimiter.check(key, options);
}

export function getRateLimiterInfo() {
  return fallbackRateLimiter.describe();
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfterSeconds = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));

  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "X-RateLimit-Backend": result.backend,
    ...(result.allowed ? {} : { "Retry-After": String(retryAfterSeconds) }),
  };
}

export function resetRateLimitStateForTests(): void {
  if (process.env.NODE_ENV === "test") {
    fallbackRateLimiter.reset();
  }
}
