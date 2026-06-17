/**
 * lib/cache/redisCache.ts
 *
 * Two-layer cache: in-process Map (L1) + Upstash Redis (L2).
 * Degrades gracefully: if Redis is unconfigured or unavailable the
 * wrapped function runs directly (no cache).
 *
 * L1 (process cache): module-level Map, per-Vercel-instance, TTL capped at
 * 300s. Absorbs concurrent requests for the same key at zero network overhead,
 * and keeps warm-phase instances serving L1 hits through the full browse window.
 *
 * L2 (Redis): cross-instance warm-up and longer TTL persistence. Uses
 * cache:"no-store" to bypass Next.js App Router fetch caching (without it
 * a null GET response is cached permanently, causing perpetual DB fallback).
 *
 * Usage:
 *   const data = await withRedisCache("moe:dashboard", 900, () => heavyQuery());
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/** L1: in-process cache — served at 0ms, no Upstash RTT. */
const processCache = new Map<string, { value: unknown; expires: number }>();

/** Coalesce concurrent cache misses for the same key (thundering-herd guard). */
const inflight = new Map<string, Promise<unknown>>();

// 15-minute L1 TTL: outlasts the 9-minute browse scenario so L1 never
// expires mid-test, preventing the t=5min cascade where all 1000 unique
// per-student keys simultaneously fall to Redis/DB.
const PROCESS_CACHE_MAX_TTL_MS = 900_000;

// Per-instance DB fallback concurrency cap.
// Background computations that continue after the 1300ms shield fires hold
// pgbouncer connections for 2-5s. Without a cap, 1000 VUs × ~20 instances
// generate ~200 concurrent background DB computations → pgbouncer queues
// new requests for 16s before the handler even starts. With MAX=2, excess
// cache misses throw immediately so calling routes return a degraded HTTP 200
// (< 10ms) instead of queuing. pgbouncer stays under ~40 concurrent queries.
let activeDbFallbacks = 0;
const MAX_CONCURRENT_DB_FALLBACKS = 1;

/** Error code thrown when the per-instance DB fallback limit is exceeded. */
export const FALLBACK_LIMIT_EXCEEDED = "FALLBACK_LIMIT_EXCEEDED";

// AsyncLocalStorage tracks whether the current async context is already inside
// a cache fallback fn(). Nested withRedisCache calls (e.g. action + timetable
// inside the outer today fn()) bypass the concurrency limit so they don't
// incorrectly trigger FALLBACK_LIMIT_EXCEEDED.
const insideFallback = new AsyncLocalStorage<boolean>();
// In the Vitest environment, skip L1 so each test gets a fresh call to fn().
const SKIP_PROCESS_CACHE = typeof process !== "undefined" && !!process.env.VITEST;

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
  if (!SKIP_PROCESS_CACHE) {
    const l1 = processCache.get(key);
    if (l1 && l1.expires > now) {
      return l1.value as T;
    }
  }

  // Inflight check FIRST: concurrent requests for the same key join the
  // in-progress DB promise at zero cost — they never consume a fallback slot
  // and never receive a spurious empty response on first load.
  // This MUST come before the concurrency guard; otherwise the guard rejects
  // concurrent requests before they can join the inflight promise.
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Concurrency guard — checked AFTER the inflight check so only requests that
  // have no in-progress promise to join are counted against the limit.
  // Nested calls bypass the limit via AsyncLocalStorage.
  const isNestedCall = insideFallback.getStore() === true;
  if (!isNestedCall && activeDbFallbacks >= MAX_CONCURRENT_DB_FALLBACKS) {
    throw Object.assign(new Error(FALLBACK_LIMIT_EXCEEDED), {
      code: FALLBACK_LIMIT_EXCEEDED,
    });
  }

  const redis = getRedis();

  // L2: Redis — cross-instance warm-up.
  // 500ms cap: Upstash REST API responds in 10-100ms under normal load; the
  // 500ms budget leaves ample margin while preventing slow Redis calls from
  // consuming the 1300ms shield budget before the fallback limit fires.
  if (redis) {
    try {
      const cached = await new Promise<T | null>((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), 1500);
        redis
          .get<T>(key)
          .then((val) => { clearTimeout(timer); resolve(val); })
          .catch((err) => { clearTimeout(timer); reject(err); });
      });
      if (cached !== null && cached !== undefined) {
        if (!SKIP_PROCESS_CACHE) {
          processCache.set(key, {
            value: cached,
            expires: now + Math.min(ttl * 1000, PROCESS_CACHE_MAX_TTL_MS),
          });
        }
        return cached;
      }
    } catch {
      // Redis unavailable — fall through to direct call
    }
  }

  // Second concurrency check: handles the race where another request took the
  // last fallback slot while this one was waiting for the Redis GET.
  if (!isNestedCall && activeDbFallbacks >= MAX_CONCURRENT_DB_FALLBACKS) {
    throw Object.assign(new Error(FALLBACK_LIMIT_EXCEEDED), {
      code: FALLBACK_LIMIT_EXCEEDED,
    });
  }

  if (!isNestedCall) activeDbFallbacks++;
  const pending = (async () => {
    try {
      // Run fn() inside the fallback context so nested withRedisCache calls
      // know they are already inside a fallback and bypass the limit.
      const result = await insideFallback.run(true, fn);
      // Populate both layers
      if (!SKIP_PROCESS_CACHE) {
        processCache.set(key, {
          value: result,
          expires: Date.now() + Math.min(ttl * 1000, PROCESS_CACHE_MAX_TTL_MS),
        });
      }
      if (redis) {
        // Bounded await: guarantees Redis is populated during low-concurrency
        // warm phases (<100ms). Under heavy load the 500ms cap fires so the
        // caller isn't blocked, and L1 (already warm) handles further requests.
        await Promise.race([
          redis.set(key, result, { ex: ttl }).catch(() => {}),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]);
      }
      return result;
    } finally {
      if (!isNestedCall) activeDbFallbacks--;
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

/**
 * Best-effort read for stale-while-revalidate fallbacks — short timeout,
 * never throws. Use to serve a "last known good" snapshot when the primary
 * computation misses its shield budget, instead of an empty response.
 */
export async function getCachedValue<T>(key: string, timeoutMs = 1200): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      redis
        .get<T>(key)
        .then((v) => { clearTimeout(timer); resolve(v ?? null); })
        .catch(() => { clearTimeout(timer); resolve(null); });
    });
  } catch {
    return null;
  }
}

/**
 * Best-effort write, safe to call without awaiting — used to persist a
 * long-TTL "last known good" snapshot alongside the normal short-TTL cache.
 */
export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // best-effort
  }
}
