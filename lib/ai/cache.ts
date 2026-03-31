import { createHash } from "crypto";

export const AI_CACHE_TTL_MS = 5 * 60 * 1000;

export const aiCache = new Map<string, { value: unknown; expiresAt: number }>();

export function hashCacheQuery(input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(input), "utf8")
    .digest("hex");
}

export function buildAiCacheKey(
  tenantId: string,
  role: string,
  queryHash: string
): string {
  return `${tenantId}:${role}:${queryHash}`;
}

export function getCachedValue<T>(key: string): T | null {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const entry = aiCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue(
  key: string,
  value: unknown,
  ttlMs = AI_CACHE_TTL_MS
): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  aiCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}
