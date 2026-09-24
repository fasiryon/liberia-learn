"use client";

/** Publishes the signed-in learner partition to the service worker. The
 * worker caches learner-rendered pages and replays the outbox only for this
 * partition; clearing it deletes every learner page cache on the device. */
import { del, set } from "idb-keyval";

export const ACTIVE_PARTITION_IDB_KEY = "liberialearn_active_partition";

function postToServiceWorker(message: Record<string, unknown>): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage(message);
}

export async function publishActivePartition(partitionKey: string | null): Promise<void> {
  // An anonymous partition must never own a learner page cache.
  const key = partitionKey && !partitionKey.startsWith("anon|") ? partitionKey : null;
  try {
    if (key) await set(ACTIVE_PARTITION_IDB_KEY, { key, setAt: new Date().toISOString() });
    else await del(ACTIVE_PARTITION_IDB_KEY);
  } catch {
    // Without IndexedDB the worker falls back to network-only learner pages.
  }
  postToServiceWorker(key ? { type: "SET_ACTIVE_PARTITION", key } : { type: "CLEAR_LEARNER_CACHES" });
}

export function requestServiceWorkerSync(): void {
  postToServiceWorker({ type: "SYNC_NOW" });
}
