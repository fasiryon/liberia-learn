"use client";

import { useEffect, useState } from "react";
import {
  getReadyQueue,
  markSyncFailure,
  markSyncSuccess,
  markSyncConflict,
  getConflicts,
  retryConflicts,
  discardConflicts,
  clearQueue,
} from "@/lib/offline-queue";

export default function SyncManager() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState(0);

  async function doSync() {
    const queue = await getReadyQueue();
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
          await markSyncSuccess(successIds);
          await markSyncFailure(failedIds, "server_error");
          await markSyncConflict(conflictItems);
        } else {
          await clearQueue();
        }
        setSyncResult(`${data.synced ?? 0} lesson(s) synced`);
        setTimeout(() => setSyncResult(null), 5000);
      }
    } catch {
      await markSyncFailure(queue.map((q) => q.id), "network_error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    // Sync on mount if online
    if (navigator.onLine) doSync();

    // Sync when coming back online
    const handler = () => doSync();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;
    getConflicts().then((items) => {
      if (mounted) setConflictCount(items.length);
    });
    return () => {
      mounted = false;
    };
  }, [syncing, syncResult]);

  if (!syncResult && !syncing && conflictCount === 0) return null;

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
      {conflictCount > 0 && (
        <div className="mt-2 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-300">
          {conflictCount} conflict(s) need attention.
          <div className="mt-2 flex gap-2">
            <button
              className="px-3 py-1 rounded-md bg-red-600/40 hover:bg-red-600/60 text-xs"
              onClick={async () => {
                await retryConflicts();
                const items = await getConflicts();
                setConflictCount(items.length);
                if (navigator.onLine) doSync();
              }}
            >
              Retry
            </button>
            <button
              className="px-3 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-xs"
              onClick={async () => {
                await discardConflicts();
                const items = await getConflicts();
                setConflictCount(items.length);
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
