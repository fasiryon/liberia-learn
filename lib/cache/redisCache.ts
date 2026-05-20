/**
 * lib/cache/redisCache.ts
 *
 * Thin wrapper around @upstash/redis for server-side aggregate caching.
 * Degrades gracefully: if Redis is unconfigured or unavailable, the
 * wrapped function runs directly (no cache).
 *
 * Usage:
 *   const data = await withRedisCache("moe:dashboard", 900, () => heavyQuery());
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/** Coalesce concurrent cache misses for the same key (thundering-herd guard). */
const inflight = new Map<string, Promise<unknown>>();

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  // cache:'no-store' is passed through to fetch() by the @upstash/redis SDK,
  // bypassing Next.js App Router's fetch cache. Without it, a null GET response
  // on first access is served indefinitely by Next.js, causing perpetual DB
  // fallback on every request even after redis.set() stores a value.
  // retry:false = 1 attempt only. 2000ms signal = fail-fast on dead Upstash
  // without aborting writes that Upstash needs >500ms to acknowledge under load.
  _redis = new Redis({ url, token, cache: "no-store", retry: false, signal: () => AbortSignal.timeout(2000) } as any);
  return _redis;
}

/**
 * Wrap an async function with a Redis cache.
 * @param key   Cache key (unique per query shape)
 * @param ttl   TTL in seconds
 * @param fn    The function to call on cache miss
 */
export async function withRedisCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch {
      // Redis unavailable — fall through to direct call
    }
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = (async () => {
    try {
      const result = await fn();
      if (redis) {
        // Fire-and-forget: don't await the set so it doesn't add Upstash write
        // latency to the response. The 2000ms AbortSignal in getRedis() gives
        // the write enough time to complete without blocking the caller.
        redis.set(key, result, { ex: ttl }).catch(() => {});
      }
      return result;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);
  return pending;
}

/** Invalidate a cache key (best-effort). */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Ignore
  }
}
