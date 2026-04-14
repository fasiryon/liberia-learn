"use client";

import { useEffect, useState } from "react";
import {
  getReadyQueue,
  markSyncConflict,
  markSyncFailure,
  markSyncSuccess,
  getQueueStats,
} from "@/lib/offline-queue";
import { getCacheStats, purgeExpiredPacks, purgePartitionPacks } from "@/lib/offline-cache";
import { detectAndSetActiveSessionPartition, type SessionPartition } from "@/lib/offline-session";

export default function SyncManager({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [partition, setPartition] = useState<SessionPartition | null>(null);
  const [stats, setStats] = useState({
    queuePending: 0,
    queueConflicts: 0,
    queueDeadLetter: 0,
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
      const queueStats = await getQueueStats(partition ?? undefined);
      const res = await fetch("/api/student/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: queue.map((item) => ({
            id: item.id,
            opId: item.opId,
            entity: item.entity,
            endpoint: item.endpoint,
            payload: item.payload,
            scheduledWorkId: item.scheduledWorkId,
            completedAt: item.completedAt,
          })),
          queueStats: {
            pending: queueStats.queuePending,
            conflicts: queueStats.queueConflicts,
            deadLetter: queueStats.queueDeadLetter,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        await markSyncFailure(
          queue.map((item) => item.id),
          data?.error ?? "server_error",
          partition ?? undefined
        );
        setSyncResult("Offline sync queued for retry");
        return;
      }

      const syncedIds = (data?.results ?? [])
        .filter((item: { status?: string; opId?: string }) => item.status === "synced")
        .map((item: { opId?: string }) => item.opId)
        .filter((value: string | undefined): value is string => Boolean(value));
      const skippedIds = (data?.results ?? [])
        .filter((item: { status?: string; opId?: string }) => item.status === "skipped")
        .map((item: { opId?: string }) => item.opId)
        .filter((value: string | undefined): value is string => Boolean(value));
      const conflictItems = (data?.results ?? [])
        .filter((item: { status?: string; opId?: string }) => item.status === "conflict")
        .map((item: {
          opId?: string;
          entity?: string;
          serverState?: unknown;
          clientState?: unknown;
          resolutionHint?: string;
        }) => ({
          id: item.opId!,
          entity: item.entity,
          serverState: item.serverState,
          clientState: item.clientState,
          resolutionHint: item.resolutionHint,
        }))
        .filter((item: { id?: string }) => Boolean(item.id));

      const resultIdsHandled = new Set<string>([
        ...syncedIds,
        ...skippedIds,
        ...conflictItems.map((item: { id: string }) => item.id),
      ]);
      const failedIds = queue
        .map((item) => item.id)
        .filter((id) => !resultIdsHandled.has(id));

      await markSyncSuccess([...syncedIds, ...skippedIds], partition ?? undefined);
      await markSyncConflict(conflictItems, partition ?? undefined);
      await markSyncFailure(failedIds, "server_error", partition ?? undefined);
      setSyncResult(`${syncedIds.length} items synced successfully`);
      setTimeout(() => setSyncResult(null), 5000);
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
      {isPlatformAdmin ? (
        <div className="mt-2 rounded-xl bg-slate-900/90 border border-white/10 px-4 py-3 text-xs text-slate-300">
          <div className="font-semibold text-slate-200">Offline stats</div>
          <div className="mt-1">Queue pending: {stats.queuePending}</div>
          <div>Queue conflicts: {stats.queueConflicts}</div>
          <div>Queue dead-letter: {stats.queueDeadLetter}</div>
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
      ) : null}
    </div>
  );
}
