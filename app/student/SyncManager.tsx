"use client";

import { useEffect, useState } from "react";
import { getQueueStats, releaseAuthBlockedOperations } from "@/lib/offline-queue";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
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
    const result = await flushSubmissionQueue(partition ?? undefined);
    if (result.flushed > 0) {
      setSyncing(true);
      setSyncResult(`${result.flushed} item${result.flushed > 1 ? "s" : ""} synced`);
      setTimeout(() => setSyncResult(null), 5000);
      setSyncing(false);
    }
    if (result.conflicts > 0) {
      setSyncResult(`${result.conflicts} item${result.conflicts > 1 ? "s" : ""} need${result.conflicts === 1 ? "s" : ""} review`);
      setTimeout(() => setSyncResult(null), 5000);
    } else if (result.blocked > 0) {
      setSyncResult("Sign in again to sync saved offline work");
      setTimeout(() => setSyncResult(null), 5000);
    }
    await refreshStats(partition);
  }

  useEffect(() => {
    detectAndSetActiveSessionPartition().then(async (detected) => {
      setPartition(detected);
      await releaseAuthBlockedOperations(detected);
      await purgeExpiredPacks(detected);
      await refreshStats(detected);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Flush on mount / partition change if online
    if (navigator.onLine) doSync();

    // Flush when coming back online (belt-and-suspenders for iOS Safari
    // which doesn't support BackgroundSync)
    const onOnline = () => doSync();
    window.addEventListener("online", onOnline);

    // SW notifies us after a BackgroundSync flush
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "offline-sync-complete" || e.data?.type === "FLUSH_SUBMISSION_QUEUE") {
        refreshStats(partition);
        if (e.data?.syncedCount > 0) {
          setSyncResult(`${e.data.syncedCount} item${e.data.syncedCount > 1 ? "s" : ""} synced`);
          setTimeout(() => setSyncResult(null), 5000);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [partition]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh badge count every 10 s so it stays current
  useEffect(() => {
    const interval = setInterval(() => refreshStats(partition), 10_000);
    return () => clearInterval(interval);
  }, [partition]);

  const pending = stats.queuePending;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Pending submissions badge — visible to all students when there's a queue */}
      {pending > 0 && !syncing && !syncResult && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-2 text-sm text-amber-900 shadow">
          {pending} item{pending > 1 ? "s" : ""} saved offline — will sync when you&apos;re back online
        </div>
      )}

      {syncing && (
        <div className="rounded-xl bg-[var(--ll-yellow-soft)] border border-amber-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)]">
          Syncing offline work…
        </div>
      )}
      {syncResult && (
        <div className="rounded-xl bg-[var(--ll-yellow)]/20 border border-emerald-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)]">
          {syncResult}
        </div>
      )}

      {isPlatformAdmin && (
        <div className="mt-2 rounded-xl bg-[var(--ll-bg)]/90 border border-[var(--ll-border)] px-4 py-3 text-xs text-[var(--ll-text)]">
          <div className="font-semibold text-[var(--ll-text)]">Offline stats</div>
          <div className="mt-1">Queue pending: {stats.queuePending}</div>
          <div>Queue conflicts: {stats.queueConflicts}</div>
          <div>Queue dead-letter: {stats.queueDeadLetter}</div>
          <div>Cache packs: {stats.cachePacksCount}</div>
          <div>Cache bytes: {formatBytes(stats.cacheBytes)}</div>
          <button
            className="mt-2 px-3 py-1 rounded-md bg-[var(--ll-surface-muted)]/60 hover:bg-[var(--ll-surface-muted)] text-xs"
            onClick={async () => {
              await purgePartitionPacks(partition ?? undefined);
              await refreshStats(partition);
            }}
          >
            Purge cache
          </button>
        </div>
      )}
    </div>
  );
}
