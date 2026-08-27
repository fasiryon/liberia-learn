"use client";

import { del, get, set, update as updateValue } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";

const CACHE_META_PREFIX = "liberialearn_cache_meta::";
const CACHE_PACK_PREFIX = "liberialearn_cache_pack::";
const RETAINED_TRUST_SCOPES = new Set(["lesson-availability"]);

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_STORAGE_BYTES = 25 * 1024 * 1024;

export type CachePackMetadata = {
  scope: string;
  scopeId: string;
  packVersion: string;
  createdAt: string;
  lastUsedAt: string;
  sizeBytes: number;
  retainForTrust?: boolean;
};

export type CacheStats = {
  cachePacksCount: number;
  cacheBytes: number;
};

type CacheLifecyclePolicy = {
  ttlMs: number;
  maxStorageBytes: number;
};

type CacheWriteOptions = {
  createdAt?: string;
};

let lifecyclePolicy: CacheLifecyclePolicy = {
  ttlMs: DEFAULT_TTL_MS,
  maxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
};

function nowIso() {
  return new Date().toISOString();
}

function partitionKey(partition?: SessionPartitionInput) {
  return resolveSessionPartition(partition).key;
}

function metaStoreKey(partition?: SessionPartitionInput) {
  return `${CACHE_META_PREFIX}${partitionKey(partition)}`;
}

function packStoreKey(scope: string, scopeId: string, partition?: SessionPartitionInput) {
  return `${CACHE_PACK_PREFIX}${partitionKey(partition)}::${scope}::${scopeId}`;
}

function estimateBytes(value: unknown): number {
  const serialized = JSON.stringify(value ?? null);
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).length;
  }
  return serialized.length * 2;
}

function isRetainedTrustMetadata(meta: CachePackMetadata): boolean {
  return meta.retainForTrust === true || RETAINED_TRUST_SCOPES.has(meta.scope);
}

export async function getMetadata(partition?: SessionPartitionInput): Promise<CachePackMetadata[]> {
  return (await get<CachePackMetadata[]>(metaStoreKey(partition))) ?? [];
}

async function setMetadata(items: CachePackMetadata[], partition?: SessionPartitionInput): Promise<void> {
  await set(metaStoreKey(partition), items);
}

async function enforceMaxStorage(partition?: SessionPartitionInput): Promise<void> {
  const metas = await getMetadata(partition);
  let total = metas.reduce((acc, meta) => acc + meta.sizeBytes, 0);
  if (total <= lifecyclePolicy.maxStorageBytes) return;

  const ordered = metas.filter((meta) => !isRetainedTrustMetadata(meta)).sort(
    (a, b) => Date.parse(a.lastUsedAt || a.createdAt) - Date.parse(b.lastUsedAt || b.createdAt)
  );
  const toDelete: CachePackMetadata[] = [];
  for (const meta of ordered) {
    if (total <= lifecyclePolicy.maxStorageBytes) break;
    total -= meta.sizeBytes;
    toDelete.push(meta);
  }

  if (toDelete.length === 0) return;
  const deleted = new Set(toDelete.map((meta) => `${meta.scope}::${meta.scopeId}`));
  for (const meta of toDelete) {
    await del(packStoreKey(meta.scope, meta.scopeId, partition));
  }
  await setMetadata(
    metas.filter((meta) => !deleted.has(`${meta.scope}::${meta.scopeId}`)),
    partition
  );
}

export function configureCacheLifecycle(policy: Partial<CacheLifecyclePolicy>): void {
  lifecyclePolicy = {
    ttlMs: policy.ttlMs ?? lifecyclePolicy.ttlMs,
    maxStorageBytes: policy.maxStorageBytes ?? lifecyclePolicy.maxStorageBytes,
  };
}

export async function cachePack(
  scope: string,
  scopeId: string,
  packVersion: string,
  payload: unknown,
  partition?: SessionPartitionInput,
  options?: CacheWriteOptions
): Promise<CachePackMetadata> {
  const createdAt = options?.createdAt ?? nowIso();
  const meta: CachePackMetadata = {
    scope,
    scopeId,
    packVersion,
    createdAt,
    lastUsedAt: nowIso(),
    sizeBytes: estimateBytes(payload),
  };

  const metas = await getMetadata(partition);
  const filtered = metas.filter((item) => !(item.scope === scope && item.scopeId === scopeId));
  filtered.push(meta);

  await set(packStoreKey(scope, scopeId, partition), payload);
  await setMetadata(filtered, partition);
  await purgeExpiredPacks(partition);
  await enforceMaxStorage(partition);
  return meta;
}

/**
 * Atomically replace one pack only when the caller accepts the currently
 * stored value. idb-keyval performs the read/decision/write in one IndexedDB
 * transaction, so separate tabs cannot both overwrite the same trust record
 * from a stale read.
 */
export async function compareAndSwapCachedPack<T>(
  scope: string,
  scopeId: string,
  packVersion: string,
  payload: T,
  accept: (current: T | null) => boolean,
  partition?: SessionPartitionInput,
  options?: { retainForTrust?: boolean },
): Promise<boolean> {
  let accepted = false;
  await updateValue<T>(packStoreKey(scope, scopeId, partition), (current) => {
    if (!accept(current ?? null)) return current;
    accepted = true;
    return payload;
  });
  if (!accepted) return false;

  const createdAt = nowIso();
  const meta: CachePackMetadata = {
    scope,
    scopeId,
    packVersion,
    createdAt,
    lastUsedAt: createdAt,
    sizeBytes: estimateBytes(payload),
    retainForTrust: options?.retainForTrust ?? false,
  };
  const metas = await getMetadata(partition);
  await setMetadata([
    ...metas.filter((item) => !(item.scope === scope && item.scopeId === scopeId)),
    meta,
  ], partition);
  return true;
}

export async function getCachedPack<T>(
  scope: string,
  scopeId: string,
  partition?: SessionPartitionInput
): Promise<T | null> {
  await purgeExpiredPacks(partition);
  const payload = await get<T>(packStoreKey(scope, scopeId, partition));
  if (payload == null) return null;

  const metas = await getMetadata(partition);
  const updated = metas.map((meta) =>
    meta.scope === scope && meta.scopeId === scopeId ? { ...meta, lastUsedAt: nowIso() } : meta
  );
  await setMetadata(updated, partition);
  return payload;
}

export async function invalidatePack(scope: string, scopeId: string, partition?: SessionPartitionInput): Promise<void> {
  const metas = await getMetadata(partition);
  await setMetadata(
    metas.filter((meta) => !(meta.scope === scope && meta.scopeId === scopeId)),
    partition
  );
  await del(packStoreKey(scope, scopeId, partition));
}

export async function purgeExpiredPacks(
  partition?: SessionPartitionInput,
  nowMs: number = Date.now()
): Promise<number> {
  const metas = await getMetadata(partition);
  const expired = metas.filter(
    (meta) =>
      !isRetainedTrustMetadata(meta) &&
      nowMs - Date.parse(meta.lastUsedAt || meta.createdAt) > lifecyclePolicy.ttlMs,
  );
  if (expired.length === 0) return 0;

  for (const meta of expired) {
    await del(packStoreKey(meta.scope, meta.scopeId, partition));
  }
  const expiredSet = new Set(expired.map((meta) => `${meta.scope}::${meta.scopeId}`));
  await setMetadata(
    metas.filter((meta) => !expiredSet.has(`${meta.scope}::${meta.scopeId}`)),
    partition
  );
  return expired.length;
}

export async function purgePartitionPacks(partition?: SessionPartitionInput): Promise<void> {
  const metas = await getMetadata(partition);
  const retained = metas.filter(isRetainedTrustMetadata);
  for (const meta of metas.filter((item) => !isRetainedTrustMetadata(item))) {
    await del(packStoreKey(meta.scope, meta.scopeId, partition));
  }
  if (retained.length > 0) {
    await setMetadata(retained, partition);
  } else {
    await del(metaStoreKey(partition));
  }
}

export async function getCacheStats(partition?: SessionPartitionInput): Promise<CacheStats> {
  await purgeExpiredPacks(partition);
  const metas = await getMetadata(partition);
  return {
    cachePacksCount: metas.length,
    cacheBytes: metas.reduce((acc, meta) => acc + meta.sizeBytes, 0),
  };
}
