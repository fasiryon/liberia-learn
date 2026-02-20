"use client";

import { useEffect, useState } from "react";
import {
  getReadyQueue,
  markSyncFailure,
  markSyncSuccess,
  markSyncConflict,
  getQueueStats,
  retryConflicts,
  discardConflicts,
  clearQueue,
} from "@/lib/offline-queue";
import { getCacheStats, purgeExpiredPacks, purgePartitionPacks } from "@/lib/offline-cache";
import { detectAndSetActiveSessionPartition, type SessionPartition } from "@/lib/offline-session";

export default function SyncManager() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [partition, setPartition] = useState<SessionPartition | null>(null);
  const [stats, setStats] = useState({
    queuePending: 0,
    queueConflicts: 0,
    cachePacksCount: 0,
    cacheBytes: 0,
  });

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function refreshStats(currentPartition: SessionPartition | null) {
    const queueStats = await getQueueStats(currentPartition ?? undefined);
    const cacheStats = await getCacheStats(currentPartition ?? undefined);
    setStats({
      ...queueStats,
      ...cacheStats,
    });
  }

  async function doSync() {
    const queue = await getReadyQueue(partition ?? undefined);
    if (queue.length === 0) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/student/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: queue }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.results)) {
          const successIds = data.results
            .filter((r: any) => r.status === "synced")
            .map((r: any) => r.opId ?? r.id);
          const failedIds = data.results
            .filter((r: any) => r.status === "skipped")
            .map((r: any) => r.opId ?? r.id);
          const conflictItems = data.results
            .filter((r: any) => r.status === "conflict")
            .map((r: any) => ({
              id: r.opId ?? r.id,
              entity: r.entity,
              serverState: r.serverState,
              clientState: r.clientState,
              resolutionHint: r.resolutionHint,
            }));
          await markSyncSuccess(successIds, partition ?? undefined);
          await markSyncFailure(failedIds, "server_error", partition ?? undefined);
          await markSyncConflict(conflictItems, partition ?? undefined);
        } else {
          await clearQueue(partition ?? undefined);
        }
        setSyncResult(`${data.synced ?? 0} lesson(s) synced`);
        setTimeout(() => setSyncResult(null), 5000);
      }
    } catch {
      await markSyncFailure(queue.map((q) => q.id), "network_error", partition ?? undefined);
    } finally {
      setSyncing(false);
      await refreshStats(partition);
    }
  }

  useEffect(() => {
    detectAndSetActiveSessionPartition().then(async (detected) => {
      setPartition(detected);
      await purgeExpiredPacks(detected);
      await refreshStats(detected);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Sync on mount/partition change if online
    if (navigator.onLine) doSync();

    // Sync when coming back online
    const handler = () => doSync();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [partition]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshStats(partition);
  }, [syncing, syncResult, partition]);

  const conflictCount = stats.queueConflicts;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {syncing && (
        <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm text-amber-300">
          Syncing offline work...
        </div>
      )}
      {syncResult && (
        <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300">
          {syncResult}
        </div>
      )}
      <div className="mt-2 rounded-xl bg-slate-900/90 border border-white/10 px-4 py-3 text-xs text-slate-300">
        <div className="font-semibold text-slate-200">Offline stats</div>
        <div className="mt-1">Queue pending: {stats.queuePending}</div>
        <div>Queue conflicts: {stats.queueConflicts}</div>
        <div>Cache packs: {stats.cachePacksCount}</div>
        <div>Cache bytes: {formatBytes(stats.cacheBytes)}</div>
        <button
          className="mt-2 px-3 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-xs"
          onClick={async () => {
            await purgePartitionPacks(partition ?? undefined);
            await refreshStats(partition);
          }}
        >
          Purge cache
        </button>
      </div>
      {conflictCount > 0 && (
        <div className="mt-2 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-300">
          {conflictCount} conflict(s) need attention.
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 rounded-md bg-red-600/40 hover:bg-red-600/60 text-xs"
              onClick={async () => {
                await retryConflicts(undefined, partition ?? undefined);
                await refreshStats(partition);
                if (navigator.onLine) doSync();
              }}
            >
              Retry
            </button>
            <button
              className="px-3 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-xs"
              onClick={async () => {
                await discardConflicts(undefined, partition ?? undefined);
                await refreshStats(partition);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
