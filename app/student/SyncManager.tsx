"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getQueueStats,
  releaseAuthBlockedOperations,
  retryFailedOperations,
  subscribeToQueueChanges,
} from "@/lib/offline-queue";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import { reportSyncDiagnostics } from "@/lib/offline/syncDiagnosticsReporter";
import { getCacheStats, purgeExpiredPacks, purgePartitionPacks } from "@/lib/offline-cache";
import { detectAndSetActiveSessionPartition, type SessionPartition } from "@/lib/offline-session";

// Coalesces bursts of `online` events from a flapping 2G/3G connection.
const RECONNECT_DEBOUNCE_MS = 2000;

export default function SyncManager({
  isPlatformAdmin,
}: {
  isPlatformAdmin: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [partition, setPartition] = useState<SessionPartition | null>(null);
  const [online, setOnline] = useState(true);
  const [stats, setStats] = useState({
    queuePending: 0,
    queueConflicts: 0,
    queueDeadLetter: 0,
    queueAuthRequired: 0,
    cachePacksCount: 0,
    cacheBytes: 0,
  });
  const partitionRef = useRef<SessionPartition | null>(null);
  partitionRef.current = partition;

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const refreshStats = useCallback(async () => {
    const current = partitionRef.current ?? undefined;
    try {
      const queueStats = await getQueueStats(current);
      const cacheStats = await getCacheStats(current);
      setStats({ ...queueStats, ...cacheStats });
    } catch {
      // Storage unavailable: keep the last known state rather than a false zero.
    }
  }, []);

  function flash(message: string) {
    setSyncResult(message);
    setTimeout(() => setSyncResult(null), 5000);
  }

  const doSync = useCallback(async () => {
    if (!partitionRef.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await flushSubmissionQueue(partitionRef.current);
      if (result.conflicts > 0) {
        flash(`${result.conflicts} item${result.conflicts > 1 ? "s" : ""} need${result.conflicts === 1 ? "s" : ""} review`);
      } else if (result.blocked > 0) {
        flash("Sign in again to sync saved offline work");
      } else if (result.flushed > 0) {
        flash(`${result.flushed} item${result.flushed > 1 ? "s" : ""} synced`);
      }
    } catch {
      flash("Offline work could not sync yet. It remains saved on this device.");
    } finally {
      setSyncing(false);
      await refreshStats();
      void reportSyncDiagnostics(partitionRef.current ?? undefined);
    }
  }, [refreshStats]);

  useEffect(() => {
    detectAndSetActiveSessionPartition().then(async (detected) => {
      partitionRef.current = detected;
      setPartition(detected);
      await releaseAuthBlockedOperations(detected);
      await purgeExpiredPacks(detected);
      await refreshStats();
      void reportSyncDiagnostics(detected);
    });
  }, [refreshStats]);

  useEffect(() => {
    if (!partition) return;
    setOnline(navigator.onLine);
    if (navigator.onLine) void doSync();

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const onOnline = () => {
      setOnline(true);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => { void doSync(); }, RECONNECT_DEBOUNCE_MS);
    };
    const onOffline = () => {
      setOnline(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
    // Resume after the OS froze or killed the background tab (low-RAM phones).
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void doSync();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "offline-sync-complete") {
        void refreshStats();
        if (e.data?.syncedCount > 0) {
          flash(`${e.data.syncedCount} item${e.data.syncedCount > 1 ? "s" : ""} synced`);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    // Event-driven status: every queue write (this tab or another) announces
    // itself, so no IndexedDB polling loop is needed.
    const unsubscribe = subscribeToQueueChanges(() => { void refreshStats(); });

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      unsubscribe();
    };
  }, [partition, doSync, refreshStats]);

  const pending = stats.queuePending;
  const failed = stats.queueDeadLetter;
  const authRequired = stats.queueAuthRequired;
  const conflicts = stats.queueConflicts;
  const idle = !syncing && !syncResult;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {idle && authRequired > 0 && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-2 text-sm text-amber-900 shadow">
          Your sign-in expired. {authRequired} saved item{authRequired > 1 ? "s" : ""} will sync after you{" "}
          <Link href="/login" className="underline font-semibold">sign in again</Link>.
        </div>
      )}
      {idle && pending - authRequired > 0 && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-2 text-sm text-amber-900 shadow">
          {online
            ? `${pending - authRequired} item${pending - authRequired > 1 ? "s" : ""} waiting to sync`
            : `You are offline. ${pending - authRequired} item${pending - authRequired > 1 ? "s are" : " is"} saved on this device and will sync when you reconnect.`}
        </div>
      )}
      {idle && failed > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-2 text-sm text-red-900 shadow">
          {failed} item{failed > 1 ? "s" : ""} could not sync. It is still saved on this device.{" "}
          <button
            type="button"
            className="underline font-semibold"
            onClick={async () => {
              await retryFailedOperations(undefined, partitionRef.current ?? undefined);
              await doSync();
            }}
          >
            Try again
          </button>
        </div>
      )}
      {idle && conflicts > 0 && (
        <div className="rounded-lg bg-amber-100 border border-amber-300 px-4 py-2 text-sm text-amber-900 shadow">
          {conflicts} item{conflicts > 1 ? "s" : ""} need{conflicts === 1 ? "s" : ""} review.{" "}
          <Link href="/student/offline-status" className="underline font-semibold">See details</Link>
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
              await refreshStats();
            }}
          >
            Purge cache
          </button>
        </div>
      )}
    </div>
  );
}
