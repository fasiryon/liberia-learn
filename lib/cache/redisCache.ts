/**
 * lib/cache/redisCache.ts
 *
 * Two-layer cache: in-process Map (L1) + Upstash Redis (L2).
 * Degrades gracefully: if Redis is unconfigured or unavailable the
 * wrapped function runs directly (no cache).
 *
 * L1 (process cache): module-level Map, per-Vercel-instance, TTL capped at
 * 120s. Absorbs concurrent requests for the same key with zero network
 * overhead, eliminating the Upstash thundering-herd problem at 1000 VUs.
 *
 * L2 (Redis): cross-instance warm-up and longer TTL persistence. Uses
 * cache:"no-store" to bypass Next.js App Router fetch caching (without it
 * a null GET response is cached permanently, causing perpetual DB fallback).
 *
 * Usage:
 *   const data = await withRedisCache("moe:dashboard", 900, () => heavyQuery());
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/** L1: in-process cache — served at 0ms, no Upstash RTT. */
const processCache = new Map<string, { value: unknown; expires: number }>();

/** Coalesce concurrent cache misses for the same key (thundering-herd guard). */
const inflight = new Map<string, Promise<unknown>>();

const PROCESS_CACHE_MAX_TTL_MS = 120_000;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  // cache:'no-store' bypasses Next.js App Router fetch cache so Redis GET
  // responses are never served stale. retry:false = 1 attempt only.
  _redis = new Redis({ url, token, cache: "no-store", retry: false } as any);
  return _redis;
}

/**
 * Wrap an async function with a two-layer cache (process → Redis).
 * @param key   Cache key (unique per query shape)
 * @param ttl   TTL in seconds
 * @param fn    The function to call on cache miss
 */
export async function withRedisCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();

  // L1: in-process cache — zero latency per Vercel instance
  const l1 = processCache.get(key);
  if (l1 && l1.expires > now) {
    return l1.value as T;
  }

  const redis = getRedis();

  // L2: Redis — cross-instance warm-up
  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        processCache.set(key, {
          value: cached,
          expires: now + Math.min(ttl * 1000, PROCESS_CACHE_MAX_TTL_MS),
        });
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
      // Populate both layers
      processCache.set(key, {
        value: result,
        expires: Date.now() + Math.min(ttl * 1000, PROCESS_CACHE_MAX_TTL_MS),
      });
      if (redis) {
        // Fire-and-forget so Upstash write latency doesn't block the caller.
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

/** Invalidate a cache key from both layers (best-effort). */
export async function invalidateCache(key: string): Promise<void> {
  processCache.delete(key);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Ignore
  }
}
